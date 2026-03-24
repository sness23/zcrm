import fs from "fs";
import path from "path";
import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import matter from "gray-matter";
import { Event } from "./event-log.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

type Kind =
  | "account"
  | "contact"
  | "opportunity"
  | "activity"
  | "lead"
  | "task"
  | "quote"
  | "product"
  | "campaign"
  | "event"
  | "order"
  | "contract"
  | "asset"
  | "case"
  | "knowledge"
  | "party"
  | "individual"
  | "organization"
  | "household"
  | "party-identification"
  | "account-contact-relationship"
  | "contact-point-email"
  | "contact-point-phone"
  | "contact-point-address"
  | "contact-point-consent"
  | "data-use-purpose"
  | "researcher-profile"
  | "organization-profile"
  | "party-source"
  | "party-engagement";

const KIND_DIR: Record<Kind, string> = {
  account: "accounts",
  contact: "contacts",
  opportunity: "opportunities",
  activity: "activities",
  lead: "leads",
  task: "tasks",
  quote: "quotes",
  product: "products",
  campaign: "campaigns",
  event: "events",
  order: "orders",
  contract: "contracts",
  asset: "assets",
  case: "cases",
  knowledge: "knowledge",
  party: "parties",
  individual: "individuals",
  organization: "organizations",
  household: "households",
  "party-identification": "party-identifications",
  "account-contact-relationship": "account-contact-relationships",
  "contact-point-email": "contact-point-emails",
  "contact-point-phone": "contact-point-phones",
  "contact-point-address": "contact-point-addresses",
  "contact-point-consent": "contact-point-consents",
  "data-use-purpose": "data-use-purposes",
  "researcher-profile": "researcher-profiles",
  "organization-profile": "organization-profiles",
  "party-source": "party-sources",
  "party-engagement": "party-engagements",
};

const ID_PREFIXES: Record<Kind, string> = {
  account: "acc_",
  contact: "con_",
  opportunity: "opp_",
  activity: "act_",
  lead: "led_",
  task: "tsk_",
  quote: "quo_",
  product: "prd_",
  campaign: "cmp_",
  event: "evt_",
  order: "ord_",
  contract: "ctr_",
  asset: "ast_",
  case: "cas_",
  knowledge: "kav_",
  party: "pty_",
  individual: "ind_",
  organization: "org_",
  household: "hsh_",
  "party-identification": "pid_",
  "contact-point-email": "cpe_",
  "contact-point-phone": "cpp_",
  "contact-point-address": "cpa_",
  "contact-point-consent": "cpc_",
  "data-use-purpose": "dup_",
  "researcher-profile": "rsp_",
  "organization-profile": "osp_",
  "party-source": "pso_",
  "party-engagement": "pen_",
  "account-contact-relationship": "acr_",
};

export class Validator {
  private ajv: Ajv;
  private vaultPath: string;
  private schemaValidators: Map<string, ValidateFunction>;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      validateSchema: false,
    });
    addFormats(this.ajv);
    this.schemaValidators = new Map();
  }

  /**
   * Validate an event
   */
  async validateEvent(event: Event): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    switch (event.type) {
      case "create":
        return this.validateCreate(event);
      case "update":
        return this.validateUpdate(event);
      case "delete":
        return this.validateDelete(event);
      case "bulk":
        return this.validateBulk(event);
      default:
        result.valid = false;
        result.errors.push(`Unknown event type: ${event.type}`);
        return result;
    }
  }

  /**
   * Validate a create event
   */
  private async validateCreate(event: Event): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Check entity type
    if (!event.entity_type) {
      result.valid = false;
      result.errors.push("entity_type is required");
      return result;
    }

    const kind = event.entity_type.toLowerCase() as Kind;
    if (!KIND_DIR[kind]) {
      result.valid = false;
      result.errors.push(`Unknown entity type: ${event.entity_type}`);
      return result;
    }

    // Check data
    if (!event.data) {
      result.valid = false;
      result.errors.push("data is required for create events");
      return result;
    }

    // Prepare data for validation: add type and ID if not present
    const dataToValidate = { ...event.data };

    if (!dataToValidate.type) {
      dataToValidate.type = event.entity_type;
    }

    // Check ID format if provided, or note that it will be generated
    if (dataToValidate.id) {
      const expectedPrefix = ID_PREFIXES[kind];
      if (!dataToValidate.id.startsWith(expectedPrefix)) {
        result.valid = false;
        result.errors.push(
          `ID must start with ${expectedPrefix}, got: ${dataToValidate.id}`
        );
      }

      // Check if entity already exists
      const exists = await this.entityExists(kind, dataToValidate.id);
      if (exists) {
        result.valid = false;
        result.errors.push(`Entity with ID ${dataToValidate.id} already exists`);
      }
    } else {
      // ID will be auto-generated, add a dummy for schema validation
      dataToValidate.id = ID_PREFIXES[kind] + "00000000000000000000000000";
    }

    // Validate against schema
    const schemaResult = await this.validateAgainstSchema(dataToValidate, event.entity_type);
    if (!schemaResult.valid) {
      result.valid = false;
      result.errors.push(...schemaResult.errors);
    }

    return result;
  }

  /**
   * Validate an update event
   */
  private async validateUpdate(event: Event): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Check entity_id
    if (!event.entity_id) {
      result.valid = false;
      result.errors.push("entity_id is required for update events");
      return result;
    }

    // Check changes
    if (!event.changes || Object.keys(event.changes).length === 0) {
      result.valid = false;
      result.errors.push("changes is required and must not be empty");
      return result;
    }

    // Find the entity
    const entity = await this.findEntity(event.entity_id);
    if (!entity) {
      result.valid = false;
      result.errors.push(`Entity ${event.entity_id} not found`);
      return result;
    }

    // Validate that changes don't include immutable fields
    if (event.changes.id) {
      result.valid = false;
      result.errors.push("Cannot change entity ID");
    }

    if (event.changes.type) {
      result.valid = false;
      result.errors.push("Cannot change entity type");
    }

    // Merge changes with existing data and validate
    const updatedData = { ...entity.data, ...event.changes };
    const schemaResult = await this.validateAgainstSchema(
      updatedData,
      entity.data.type
    );
    if (!schemaResult.valid) {
      result.valid = false;
      result.errors.push(...schemaResult.errors);
    }

    return result;
  }

  /**
   * Validate a delete event
   */
  private async validateDelete(event: Event): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Check entity_id
    if (!event.entity_id) {
      result.valid = false;
      result.errors.push("entity_id is required for delete events");
      return result;
    }

    // Check if entity exists
    const entity = await this.findEntity(event.entity_id);
    if (!entity) {
      result.valid = false;
      result.errors.push(`Entity ${event.entity_id} not found`);
      return result;
    }

    // Check for dependent entities
    const hasDependents = await this.hasDependent(event.entity_id);
    if (hasDependents) {
      result.warnings.push(
        `Entity ${event.entity_id} has dependent entities that reference it`
      );
    }

    return result;
  }

  /**
   * Validate a bulk event
   */
  private async validateBulk(event: Event): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    if (!event.operations || event.operations.length === 0) {
      result.valid = false;
      result.errors.push("operations is required and must not be empty");
      return result;
    }

    // Validate each operation
    for (let i = 0; i < event.operations.length; i++) {
      const op = event.operations[i];
      const opResult = await this.validateEvent(op as Event);

      if (!opResult.valid) {
        result.valid = false;
        opResult.errors.forEach((err) => {
          result.errors.push(`Operation ${i}: ${err}`);
        });
      }

      result.warnings.push(...opResult.warnings);
    }

    return result;
  }

  /**
   * Validate data against JSON schema
   */
  private async validateAgainstSchema(
    data: any,
    entityType: string
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    const schemaPath = path.join(
      this.vaultPath,
      "_schemas",
      `${entityType}.schema.json`
    );

    if (!fs.existsSync(schemaPath)) {
      result.warnings.push(`Schema not found: ${entityType}.schema.json`);
      return result;
    }

    // Load or get cached validator
    let validate = this.schemaValidators.get(entityType);
    if (!validate) {
      const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
      validate = this.ajv.compile(schema);
      this.schemaValidators.set(entityType, validate);
    }

    const valid = validate(data);

    if (!valid && validate.errors) {
      result.valid = false;
      result.errors = validate.errors.map(
        (err) => `${err.instancePath} ${err.message}`
      );
    }

    return result;
  }

  /**
   * Check if entity exists
   */
  private async entityExists(kind: Kind, id: string): Promise<boolean> {
    const dir = path.join(this.vaultPath, KIND_DIR[kind]);
    if (!fs.existsSync(dir)) {
      return false;
    }

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      const parsed = matter(content);

      if (parsed.data.id === id) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find entity by ID
   */
  private async findEntity(
    id: string
  ): Promise<{ path: string; data: any } | null> {
    // Determine entity type from ID prefix
    let kind: Kind | null = null;
    for (const [k, prefix] of Object.entries(ID_PREFIXES)) {
      if (id.startsWith(prefix)) {
        kind = k as Kind;
        break;
      }
    }

    if (!kind) {
      return null;
    }

    const dir = path.join(this.vaultPath, KIND_DIR[kind]);
    if (!fs.existsSync(dir)) {
      return null;
    }

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = matter(content);

      if (parsed.data.id === id) {
        return {
          path: filePath,
          data: parsed.data,
        };
      }
    }

    return null;
  }

  /**
   * Check if entity has dependents
   */
  private async hasDependent(id: string): Promise<boolean> {
    // Search all entity files for references to this ID
    for (const kind of Object.keys(KIND_DIR)) {
      const dir = path.join(this.vaultPath, KIND_DIR[kind as Kind]);
      if (!fs.existsSync(dir)) {
        continue;
      }

      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), "utf8");

        // Check if content contains the ID
        if (content.includes(id)) {
          return true;
        }
      }
    }

    return false;
  }
}
