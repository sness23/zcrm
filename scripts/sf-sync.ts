#!/usr/bin/env tsx
/**
 * Salesforce Multi-Object Sync
 *
 * Generic bi-directional sync for multiple Salesforce objects:
 * - Accounts, Contacts, Opportunities, Leads, Tasks, Events, Quotes, Products, Campaigns
 *
 * Usage:
 *   npx tsx scripts/sf-sync.ts load <object>         # Load specific object
 *   npx tsx scripts/sf-sync.ts load all              # Load all objects
 *   npx tsx scripts/sf-sync.ts save <object>         # Save specific object
 *   npx tsx scripts/sf-sync.ts status                # Show sync status
 *   npx tsx scripts/sf-sync.ts list <object>         # List records
 */

import * as fs from 'fs';
import * as path from 'path';
import { ulid } from 'ulidx';
import { exec } from 'child_process';
import { promisify } from 'util';
import matter from 'gray-matter';

const execAsync = promisify(exec);

// ============================================================================
// Object Type Configurations
// ============================================================================

interface ObjectConfig {
  sfObject: string;        // Salesforce object API name
  fsType: string;          // Zax CRM type name
  vaultDir: string;        // Vault subdirectory
  idPrefix: string;        // ID prefix (e.g., 'acc_', 'con_')
  fields: string[];        // Salesforce fields to query
  transform: (sfRecord: any) => any;  // SF → FS transformer
  reverseTransform: (fsRecord: any) => any;  // FS → SF transformer
  optional?: boolean;      // If true, won't fail entire sync if object is unavailable
}

const OBJECT_CONFIGS: Record<string, ObjectConfig> = {
  accounts: {
    sfObject: 'Account',
    fsType: 'Account',
    vaultDir: 'accounts',
    idPrefix: 'acc_',
    fields: [
      'Id', 'Name', 'Type', 'Industry', 'AnnualRevenue', 'NumberOfEmployees',
      'Website', 'Phone', 'Fax', 'BillingStreet', 'BillingCity', 'BillingState',
      'BillingPostalCode', 'BillingCountry', 'ShippingStreet', 'ShippingCity',
      'ShippingState', 'ShippingPostalCode', 'ShippingCountry', 'Description',
      'OwnerId', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'
    ],
    transform: (sf) => ({
      id: `acc_${ulid().toLowerCase()}`,
      type: 'Account',
      name: sf.Name,
      account_type: sf.Type,
      industry: sf.Industry,
      annual_revenue: sf.AnnualRevenue,
      employee_count: sf.NumberOfEmployees,
      website: sf.Website,
      phone: sf.Phone,
      fax: sf.Fax,
      billing_street: sf.BillingStreet,
      billing_city: sf.BillingCity,
      billing_state: sf.BillingState,
      billing_postal_code: sf.BillingPostalCode,
      billing_country: sf.BillingCountry,
      shipping_street: sf.ShippingStreet,
      shipping_city: sf.ShippingCity,
      shipping_state: sf.ShippingState,
      shipping_postal_code: sf.ShippingPostalCode,
      shipping_country: sf.ShippingCountry,
      description: sf.Description,
      sf_id: sf.Id,
      sf_synced_at: new Date().toISOString(),
      created_at: new Date(sf.CreatedDate).toISOString(),
      updated_at: new Date(sf.LastModifiedDate).toISOString(),
      created_by_sf_id: sf.CreatedById,
      updated_by_sf_id: sf.LastModifiedById,
      owner_sf_id: sf.OwnerId,
    }),
    reverseTransform: (fs) => ({
      Name: fs.name,
      Type: fs.account_type,
      Industry: fs.industry,
      AnnualRevenue: fs.annual_revenue,
      NumberOfEmployees: fs.employee_count,
      Website: fs.website,
      Phone: fs.phone,
      Fax: fs.fax,
      BillingStreet: fs.billing_street,
      BillingCity: fs.billing_city,
      BillingState: fs.billing_state,
      BillingPostalCode: fs.billing_postal_code,
      BillingCountry: fs.billing_country,
      ShippingStreet: fs.shipping_street,
      ShippingCity: fs.shipping_city,
      ShippingState: fs.shipping_state,
      ShippingPostalCode: fs.shipping_postal_code,
      ShippingCountry: fs.shipping_country,
      Description: fs.description,
    }),
  },

  contacts: {
    sfObject: 'Contact',
    fsType: 'Contact',
    vaultDir: 'contacts',
    idPrefix: 'con_',
    fields: [
      'Id', 'FirstName', 'LastName', 'Name', 'AccountId', 'Title', 'Email',
      'Phone', 'MobilePhone', 'Department', 'Birthdate', 'MailingStreet',
      'MailingCity', 'MailingState', 'MailingPostalCode', 'MailingCountry',
      'Description', 'OwnerId', 'CreatedDate', 'LastModifiedDate',
      'CreatedById', 'LastModifiedById'
    ],
    transform: (sf) => ({
      id: `con_${ulid().toLowerCase()}`,
      type: 'Contact',
      name: sf.Name,
      first_name: sf.FirstName,
      last_name: sf.LastName,
      account_sf_id: sf.AccountId,
      title: sf.Title,
      email: sf.Email,
      phone: sf.Phone,
      mobile_phone: sf.MobilePhone,
      department: sf.Department,
      birthdate: sf.Birthdate,
      mailing_street: sf.MailingStreet,
      mailing_city: sf.MailingCity,
      mailing_state: sf.MailingState,
      mailing_postal_code: sf.MailingPostalCode,
      mailing_country: sf.MailingCountry,
      description: sf.Description,
      sf_id: sf.Id,
      sf_synced_at: new Date().toISOString(),
      created_at: new Date(sf.CreatedDate).toISOString(),
      updated_at: new Date(sf.LastModifiedDate).toISOString(),
      created_by_sf_id: sf.CreatedById,
      updated_by_sf_id: sf.LastModifiedById,
      owner_sf_id: sf.OwnerId,
    }),
    reverseTransform: (fs) => ({
      FirstName: fs.first_name,
      LastName: fs.last_name,
      AccountId: fs.account_sf_id,
      Title: fs.title,
      Email: fs.email,
      Phone: fs.phone,
      MobilePhone: fs.mobile_phone,
      Department: fs.department,
      Birthdate: fs.birthdate,
      MailingStreet: fs.mailing_street,
      MailingCity: fs.mailing_city,
      MailingState: fs.mailing_state,
      MailingPostalCode: fs.mailing_postal_code,
      MailingCountry: fs.mailing_country,
      Description: fs.description,
    }),
  },

  opportunities: {
    sfObject: 'Opportunity',
    fsType: 'Opportunity',
    vaultDir: 'opportunities',
    idPrefix: 'opp_',
    fields: [
      'Id', 'Name', 'AccountId', 'Amount', 'CloseDate', 'StageName', 'Probability',
      'Type', 'LeadSource', 'Description', 'NextStep', 'IsClosed', 'IsWon',
      'ForecastCategory', 'OwnerId', 'CreatedDate', 'LastModifiedDate',
      'CreatedById', 'LastModifiedById'
    ],
    transform: (sf) => ({
      id: `opp_${ulid().toLowerCase()}`,
      type: 'Opportunity',
      name: sf.Name,
      account_sf_id: sf.AccountId,
      amount: sf.Amount,
      close_date: sf.CloseDate,
      stage_name: sf.StageName,
      probability: sf.Probability,
      opportunity_type: sf.Type,
      lead_source: sf.LeadSource,
      description: sf.Description,
      next_step: sf.NextStep,
      is_closed: sf.IsClosed,
      is_won: sf.IsWon,
      forecast_category: sf.ForecastCategory,
      sf_id: sf.Id,
      sf_synced_at: new Date().toISOString(),
      created_at: new Date(sf.CreatedDate).toISOString(),
      updated_at: new Date(sf.LastModifiedDate).toISOString(),
      created_by_sf_id: sf.CreatedById,
      updated_by_sf_id: sf.LastModifiedById,
      owner_sf_id: sf.OwnerId,
    }),
    reverseTransform: (fs) => ({
      Name: fs.name,
      AccountId: fs.account_sf_id,
      Amount: fs.amount,
      CloseDate: fs.close_date,
      StageName: fs.stage_name,
      Probability: fs.probability,
      Type: fs.opportunity_type,
      LeadSource: fs.lead_source,
      Description: fs.description,
      NextStep: fs.next_step,
    }),
  },

  leads: {
    sfObject: 'Lead',
    fsType: 'Lead',
    vaultDir: 'leads',
    idPrefix: 'led_',
    fields: [
      'Id', 'FirstName', 'LastName', 'Name', 'Company', 'Title', 'Email',
      'Phone', 'MobilePhone', 'Website', 'LeadSource', 'Status', 'Rating',
      'Industry', 'NumberOfEmployees', 'AnnualRevenue', 'Description',
      'Street', 'City', 'State', 'PostalCode', 'Country', 'OwnerId',
      'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'
    ],
    transform: (sf) => ({
      id: `led_${ulid().toLowerCase()}`,
      type: 'Lead',
      name: sf.Name,
      first_name: sf.FirstName,
      last_name: sf.LastName,
      company: sf.Company,
      title: sf.Title,
      email: sf.Email,
      phone: sf.Phone,
      mobile_phone: sf.MobilePhone,
      website: sf.Website,
      lead_source: sf.LeadSource,
      status: sf.Status,
      rating: sf.Rating,
      industry: sf.Industry,
      employee_count: sf.NumberOfEmployees,
      annual_revenue: sf.AnnualRevenue,
      description: sf.Description,
      street: sf.Street,
      city: sf.City,
      state: sf.State,
      postal_code: sf.PostalCode,
      country: sf.Country,
      sf_id: sf.Id,
      sf_synced_at: new Date().toISOString(),
      created_at: new Date(sf.CreatedDate).toISOString(),
      updated_at: new Date(sf.LastModifiedDate).toISOString(),
      created_by_sf_id: sf.CreatedById,
      updated_by_sf_id: sf.LastModifiedById,
      owner_sf_id: sf.OwnerId,
    }),
    reverseTransform: (fs) => ({
      FirstName: fs.first_name,
      LastName: fs.last_name,
      Company: fs.company,
      Title: fs.title,
      Email: fs.email,
      Phone: fs.phone,
      MobilePhone: fs.mobile_phone,
      Website: fs.website,
      LeadSource: fs.lead_source,
      Status: fs.status,
      Rating: fs.rating,
      Industry: fs.industry,
      NumberOfEmployees: fs.employee_count,
      AnnualRevenue: fs.annual_revenue,
      Description: fs.description,
      Street: fs.street,
      City: fs.city,
      State: fs.state,
      PostalCode: fs.postal_code,
      Country: fs.country,
    }),
  },

  tasks: {
    sfObject: 'Task',
    fsType: 'Task',
    vaultDir: 'tasks',
    idPrefix: 'tsk_',
    fields: [
      'Id', 'Subject', 'Status', 'Priority', 'ActivityDate', 'Description',
      'WhoId', 'WhatId', 'OwnerId', 'CreatedDate', 'LastModifiedDate',
      'CreatedById', 'LastModifiedById'
    ],
    transform: (sf) => ({
      id: `tsk_${ulid().toLowerCase()}`,
      type: 'Task',
      name: sf.Subject,
      subject: sf.Subject,
      status: sf.Status,
      priority: sf.Priority,
      activity_date: sf.ActivityDate,
      description: sf.Description,
      who_sf_id: sf.WhoId,
      what_sf_id: sf.WhatId,
      sf_id: sf.Id,
      sf_synced_at: new Date().toISOString(),
      created_at: new Date(sf.CreatedDate).toISOString(),
      updated_at: new Date(sf.LastModifiedDate).toISOString(),
      created_by_sf_id: sf.CreatedById,
      updated_by_sf_id: sf.LastModifiedById,
      owner_sf_id: sf.OwnerId,
    }),
    reverseTransform: (fs) => ({
      Subject: fs.subject,
      Status: fs.status,
      Priority: fs.priority,
      ActivityDate: fs.activity_date,
      Description: fs.description,
      WhoId: fs.who_sf_id,
      WhatId: fs.what_sf_id,
    }),
  },

  events: {
    sfObject: 'Event',
    fsType: 'Event',
    vaultDir: 'events',
    idPrefix: 'evt_',
    optional: true,  // Events might not be accessible in all orgs
    fields: [
      'Id', 'Subject', 'Location', 'StartDateTime', 'EndDateTime', 'Description',
      'WhoId', 'WhatId', 'OwnerId', 'CreatedDate', 'LastModifiedDate',
      'CreatedById', 'LastModifiedById'
    ],
    transform: (sf) => ({
      id: `evt_${ulid().toLowerCase()}`,
      type: 'Event',
      name: sf.Subject,
      subject: sf.Subject,
      location: sf.Location,
      start_date_time: sf.StartDateTime,
      end_date_time: sf.EndDateTime,
      description: sf.Description,
      who_sf_id: sf.WhoId,
      what_sf_id: sf.WhatId,
      sf_id: sf.Id,
      sf_synced_at: new Date().toISOString(),
      created_at: new Date(sf.CreatedDate).toISOString(),
      updated_at: new Date(sf.LastModifiedDate).toISOString(),
      created_by_sf_id: sf.CreatedById,
      updated_by_sf_id: sf.LastModifiedById,
      owner_sf_id: sf.OwnerId,
    }),
    reverseTransform: (fs) => ({
      Subject: fs.subject,
      Location: fs.location,
      StartDateTime: fs.start_date_time,
      EndDateTime: fs.end_date_time,
      Description: fs.description,
      WhoId: fs.who_sf_id,
      WhatId: fs.what_sf_id,
    }),
  },

  quotes: {
    sfObject: 'Quote',
    fsType: 'Quote',
    vaultDir: 'quotes',
    idPrefix: 'quo_',
    optional: true,  // Quotes require CPQ to be enabled
    fields: [
      'Id', 'Name', 'OpportunityId', 'Status', 'ExpirationDate', 'Description',
      'GrandTotal', 'Discount', 'Tax', 'ShippingHandling', 'Subtotal',
      'OwnerId', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'
    ],
    transform: (sf) => ({
      id: `quo_${ulid().toLowerCase()}`,
      type: 'Quote',
      name: sf.Name,
      opportunity_sf_id: sf.OpportunityId,
      status: sf.Status,
      expiration_date: sf.ExpirationDate,
      description: sf.Description,
      grand_total: sf.GrandTotal,
      discount: sf.Discount,
      tax: sf.Tax,
      shipping_handling: sf.ShippingHandling,
      subtotal: sf.Subtotal,
      sf_id: sf.Id,
      sf_synced_at: new Date().toISOString(),
      created_at: new Date(sf.CreatedDate).toISOString(),
      updated_at: new Date(sf.LastModifiedDate).toISOString(),
      created_by_sf_id: sf.CreatedById,
      updated_by_sf_id: sf.LastModifiedById,
      owner_sf_id: sf.OwnerId,
    }),
    reverseTransform: (fs) => ({
      Name: fs.name,
      OpportunityId: fs.opportunity_sf_id,
      Status: fs.status,
      ExpirationDate: fs.expiration_date,
      Description: fs.description,
      Discount: fs.discount,
      Tax: fs.tax,
      ShippingHandling: fs.shipping_handling,
    }),
  },

  products: {
    sfObject: 'Product2',
    fsType: 'Product',
    vaultDir: 'products',
    idPrefix: 'prd_',
    fields: [
      'Id', 'Name', 'ProductCode', 'Description', 'IsActive', 'Family',
      'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'
    ],
    transform: (sf) => ({
      id: `prd_${ulid().toLowerCase()}`,
      type: 'Product',
      name: sf.Name,
      product_code: sf.ProductCode,
      description: sf.Description,
      is_active: sf.IsActive,
      family: sf.Family,
      sf_id: sf.Id,
      sf_synced_at: new Date().toISOString(),
      created_at: new Date(sf.CreatedDate).toISOString(),
      updated_at: new Date(sf.LastModifiedDate).toISOString(),
      created_by_sf_id: sf.CreatedById,
      updated_by_sf_id: sf.LastModifiedById,
    }),
    reverseTransform: (fs) => ({
      Name: fs.name,
      ProductCode: fs.product_code,
      Description: fs.description,
      IsActive: fs.is_active,
      Family: fs.family,
    }),
  },

  campaigns: {
    sfObject: 'Campaign',
    fsType: 'Campaign',
    vaultDir: 'campaigns',
    idPrefix: 'cmp_',
    fields: [
      'Id', 'Name', 'Type', 'Status', 'StartDate', 'EndDate', 'Description',
      'IsActive', 'BudgetedCost', 'ActualCost', 'ExpectedRevenue', 'ExpectedResponse',
      'NumberSent', 'OwnerId', 'CreatedDate', 'LastModifiedDate',
      'CreatedById', 'LastModifiedById'
    ],
    transform: (sf) => ({
      id: `cmp_${ulid().toLowerCase()}`,
      type: 'Campaign',
      name: sf.Name,
      campaign_type: sf.Type,
      status: sf.Status,
      start_date: sf.StartDate,
      end_date: sf.EndDate,
      description: sf.Description,
      is_active: sf.IsActive,
      budgeted_cost: sf.BudgetedCost,
      actual_cost: sf.ActualCost,
      expected_revenue: sf.ExpectedRevenue,
      expected_response: sf.ExpectedResponse,
      number_sent: sf.NumberSent,
      sf_id: sf.Id,
      sf_synced_at: new Date().toISOString(),
      created_at: new Date(sf.CreatedDate).toISOString(),
      updated_at: new Date(sf.LastModifiedDate).toISOString(),
      created_by_sf_id: sf.CreatedById,
      updated_by_sf_id: sf.LastModifiedById,
      owner_sf_id: sf.OwnerId,
    }),
    reverseTransform: (fs) => ({
      Name: fs.name,
      Type: fs.campaign_type,
      Status: fs.status,
      StartDate: fs.start_date,
      EndDate: fs.end_date,
      Description: fs.description,
      IsActive: fs.is_active,
      BudgetedCost: fs.budgeted_cost,
      ActualCost: fs.actual_cost,
      ExpectedRevenue: fs.expected_revenue,
      ExpectedResponse: fs.expected_response,
      NumberSent: fs.number_sent,
    }),
  },
};

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  org: process.env.SF_ORG || 'snessorg',
  vaultBaseDir: path.join(process.cwd(), 'vault'),
  stateDir: path.join(process.cwd(), 'sf'),
  apiUrl: process.env.API_URL || 'http://localhost:9600/api',
};

// ============================================================================
// Types
// ============================================================================

interface SyncState {
  lastSync: string | null;
  lastSyncDirection: 'load' | 'save' | null;
  stats: {
    totalLoaded: number;
    totalSaved: number;
    lastLoadCount: number;
    lastSaveCount: number;
    errors: number;
  };
}

// ============================================================================
// Generic Sync Service
// ============================================================================

class GenericSyncService {
  private config: ObjectConfig;
  private objectName: string;
  private vaultDir: string;
  private stateFile: string;
  private state: SyncState;

  constructor(objectName: string) {
    if (!OBJECT_CONFIGS[objectName]) {
      throw new Error(`Unknown object type: ${objectName}`);
    }

    this.objectName = objectName;
    this.config = OBJECT_CONFIGS[objectName];
    this.vaultDir = path.join(CONFIG.vaultBaseDir, this.config.vaultDir);
    this.stateFile = path.join(CONFIG.stateDir, `sync-state-${objectName}.json`);
    this.state = this.loadState();
  }

  // ========== State Management ==========

  private loadState(): SyncState {
    if (fs.existsSync(this.stateFile)) {
      const content = fs.readFileSync(this.stateFile, 'utf-8');
      return JSON.parse(content);
    }

    return {
      lastSync: null,
      lastSyncDirection: null,
      stats: {
        totalLoaded: 0,
        totalSaved: 0,
        lastLoadCount: 0,
        lastSaveCount: 0,
        errors: 0,
      },
    };
  }

  private saveState(): void {
    const dir = path.dirname(this.stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  private updateLastSync(direction: 'load' | 'save', count: number): void {
    this.state.lastSync = new Date().toISOString();
    this.state.lastSyncDirection = direction;

    if (direction === 'load') {
      this.state.stats.lastLoadCount = count;
      this.state.stats.totalLoaded += count;
    } else {
      this.state.stats.lastSaveCount = count;
      this.state.stats.totalSaved += count;
    }

    this.saveState();
  }

  // ========== Salesforce Query ==========

  private async queryRecords(sinceDate?: string): Promise<any[]> {
    console.log(`Querying ${this.config.sfObject} from Salesforce...`);

    let soql = `SELECT ${this.config.fields.join(', ')} FROM ${this.config.sfObject}`;

    if (sinceDate) {
      soql += ` WHERE LastModifiedDate > ${sinceDate}`;
    }

    soql += ' ORDER BY LastModifiedDate ASC';

    try {
      console.log(`  SOQL: ${soql}`);

      const { stdout, stderr } = await execAsync(
        `sf data query -o ${CONFIG.org} -q "${soql}" --json`
      );

      const result = JSON.parse(stdout);

      if (result.status !== 0) {
        const errorMsg = result.message || result.name || 'Unknown error';
        throw new Error(`SF CLI error: ${errorMsg}`);
      }

      const records = result.result?.records || [];
      console.log(`  ✓ Loaded ${records.length} ${this.config.sfObject} records`);

      return records;
    } catch (error: any) {
      // Try to parse the error for more details
      let errorMsg = error.message;

      if (error.stderr) {
        try {
          const stderrJson = JSON.parse(error.stderr);
          errorMsg = stderrJson.message || stderrJson.name || errorMsg;
        } catch {
          // stderr is not JSON, use as-is
          if (error.stderr.includes('INVALID_TYPE')) {
            errorMsg = `Object type '${this.config.sfObject}' is not available or not enabled in this org`;
          } else if (error.stderr.includes('INVALID_FIELD')) {
            errorMsg = `One or more fields are not available for ${this.config.sfObject}`;
          }
        }
      }

      console.error(`  ✗ Failed to query ${this.config.sfObject}: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  // ========== Transform & Write ==========

  private findExisting(sfId: string): { filePath: string; record: any } | null {
    if (!fs.existsSync(this.vaultDir)) {
      return null;
    }

    const files = fs.readdirSync(this.vaultDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(this.vaultDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = matter(content);
      const record = parsed.data;

      if (record.sf_id === sfId) {
        return { filePath, record };
      }
    }

    return null;
  }

  private writeToVault(record: any): void {
    if (!fs.existsSync(this.vaultDir)) {
      fs.mkdirSync(this.vaultDir, { recursive: true });
    }

    const slug = this.slugify(record.name);
    const filename = `${slug}.md`;
    const filePath = path.join(this.vaultDir, filename);

    // Build markdown content
    const body = record.description
      ? `# ${record.name}\n\n${record.description}\n`
      : `# ${record.name}\n`;

    // Remove undefined, null values and description from frontmatter
    const frontmatter: any = {};
    for (const [key, value] of Object.entries(record)) {
      if (value !== undefined && value !== null && key !== 'description') {
        frontmatter[key] = value;
      }
    }

    const fileContent = matter.stringify(body, frontmatter);

    fs.writeFileSync(filePath, fileContent, 'utf-8');
    console.log(`  ✓ Written: ${filename}`);
  }

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  // ========== Load from SF ==========

  async load(fullSync: boolean = false): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log(`Loading ${this.config.sfObject} from Salesforce`);
    console.log('='.repeat(60) + '\n');

    try {
      const lastSync = fullSync ? null : this.state.lastSync;

      if (lastSync) {
        console.log(`Incremental sync since: ${new Date(lastSync).toLocaleString()}`);
      } else {
        console.log('Full sync (no previous sync found)');
      }

      const sfRecords = await this.queryRecords(lastSync || undefined);

      if (sfRecords.length === 0) {
        console.log(`\n  ℹ No ${this.objectName} to sync`);
        return;
      }

      console.log(`\nProcessing ${sfRecords.length} record(s)...\n`);

      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const sfRecord of sfRecords) {
        try {
          const existing = this.findExisting(sfRecord.Id);

          if (existing) {
            console.log(`Updating: ${sfRecord.Name || sfRecord.Subject || sfRecord.Id}`);
            const fsRecord = this.config.transform(sfRecord);
            // Preserve existing ID
            fsRecord.id = existing.record.id;
            this.writeToVault(fsRecord);
            updated++;
          } else {
            console.log(`Creating: ${sfRecord.Name || sfRecord.Subject || sfRecord.Id}`);
            const fsRecord = this.config.transform(sfRecord);
            this.writeToVault(fsRecord);
            created++;
          }
        } catch (error: any) {
          console.error(`  ✗ Error processing record:`, error.message);
          errors++;
        }
      }

      this.updateLastSync('load', created + updated);

      console.log('\n' + '='.repeat(60));
      console.log('Load Complete');
      console.log('='.repeat(60));
      console.log(`  Created:  ${created}`);
      console.log(`  Updated:  ${updated}`);
      console.log(`  Errors:   ${errors}`);
      console.log('='.repeat(60) + '\n');
    } catch (error: any) {
      console.error('\n✗ Load failed:', error.message);
      throw error;
    }
  }

  // ========== Save to SF ==========

  async save(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log(`Saving ${this.config.sfObject} to Salesforce`);
    console.log('='.repeat(60) + '\n');

    try {
      const lastSync = this.state.lastSync;

      if (lastSync) {
        console.log(`Finding ${this.objectName} modified since: ${new Date(lastSync).toLocaleString()}`);
      } else {
        console.log(`No previous sync - will save all ${this.objectName}`);
      }

      const modifiedRecords = this.findModifiedRecords(lastSync);

      if (modifiedRecords.length === 0) {
        console.log(`\n  ℹ No ${this.objectName} to save`);
        return;
      }

      console.log(`\nProcessing ${modifiedRecords.length} record(s)...\n`);

      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const { record, filePath } of modifiedRecords) {
        try {
          record.updated_at = new Date().toISOString();

          if (record.sf_id) {
            console.log(`Updating in SF: ${record.name} (${record.sf_id})`);
            await this.updateInSalesforce(record);
            record.sf_synced_at = new Date().toISOString();
            this.writeToVault(record);
            console.log(`  ✓ Updated in SF`);
            updated++;
          } else {
            console.log(`Creating in SF: ${record.name}`);
            const sfId = await this.createInSalesforce(record);
            record.sf_id = sfId;
            record.sf_synced_at = new Date().toISOString();
            this.writeToVault(record);
            console.log(`  ✓ Created with SF ID: ${sfId}`);
            created++;
          }
        } catch (error: any) {
          console.error(`  ✗ Error processing ${record.name}:`, error.message);
          errors++;
          this.state.stats.errors++;
        }
      }

      this.updateLastSync('save', created + updated);

      console.log('\n' + '='.repeat(60));
      console.log('Save Complete');
      console.log('='.repeat(60));
      console.log(`  Created:  ${created}`);
      console.log(`  Updated:  ${updated}`);
      console.log(`  Errors:   ${errors}`);
      console.log('='.repeat(60) + '\n');
    } catch (error: any) {
      console.error('\n✗ Save failed:', error.message);
      throw error;
    }
  }

  private findModifiedRecords(sinceDate: string | null): Array<{ record: any; filePath: string }> {
    if (!fs.existsSync(this.vaultDir)) {
      return [];
    }

    const results: Array<{ record: any; filePath: string }> = [];
    const files = fs.readdirSync(this.vaultDir).filter(f => f.endsWith('.md'));
    const cutoffDate = sinceDate ? new Date(sinceDate) : new Date(0);

    for (const file of files) {
      try {
        const filePath = path.join(this.vaultDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = matter(content);
        const record = parsed.data;

        const updatedAt = new Date(record.updated_at || record.created_at || 0);
        const stats = fs.statSync(filePath);
        const fileModTime = stats.mtime;
        const lastModified = updatedAt > fileModTime ? updatedAt : fileModTime;

        if (lastModified > cutoffDate) {
          // Include description from body if present
          if (parsed.content) {
            const body = parsed.content.replace(/^#[^\n]*\n+/, '').trim();
            if (body) {
              record.description = body;
            }
          }
          results.push({ record, filePath });
        }
      } catch (error) {
        console.warn(`  ⚠ Error reading ${file}:`, error);
      }
    }

    return results;
  }

  private escapeValue(value: any): string {
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "\\'")}'`;
    }
    return String(value);
  }

  private buildSfDataString(sfData: Record<string, any>): string {
    const pairs: string[] = [];
    for (const [key, value] of Object.entries(sfData)) {
      if (value !== undefined && value !== null && value !== '') {
        pairs.push(`${key}=${this.escapeValue(value)}`);
      }
    }
    return pairs.join(' ');
  }

  private async createInSalesforce(record: any): Promise<string> {
    const sfData = this.config.reverseTransform(record);

    // Remove undefined/null fields
    for (const key of Object.keys(sfData)) {
      if (sfData[key] === undefined || sfData[key] === null) {
        delete sfData[key];
      }
    }

    const sfDataString = this.buildSfDataString(sfData);

    try {
      const { stdout } = await execAsync(
        `sf data create record -o ${CONFIG.org} -s ${this.config.sfObject} -v "${sfDataString}" --json`
      );

      const result = JSON.parse(stdout);

      if (result.status !== 0 || !result.result?.success) {
        throw new Error(result.message || 'Failed to create record');
      }

      return result.result.id;
    } catch (error: any) {
      if (error.stdout) {
        console.error('  SF CLI output:', error.stdout);
      }
      throw new Error(`Failed to create in SF: ${error.message}`);
    }
  }

  private async updateInSalesforce(record: any): Promise<void> {
    const sfData = this.config.reverseTransform(record);

    // Remove undefined/null fields
    for (const key of Object.keys(sfData)) {
      if (sfData[key] === undefined || sfData[key] === null) {
        delete sfData[key];
      }
    }

    const sfDataString = this.buildSfDataString(sfData);

    try {
      const { stdout } = await execAsync(
        `sf data update record -o ${CONFIG.org} -s ${this.config.sfObject} -i ${record.sf_id} -v "${sfDataString}" --json`
      );

      const result = JSON.parse(stdout);

      if (result.status !== 0 || !result.result?.success) {
        throw new Error(result.message || 'Failed to update record');
      }
    } catch (error: any) {
      if (error.stdout) {
        console.error('  SF CLI output:', error.stdout);
      }
      throw new Error(`Failed to update in SF: ${error.message}`);
    }
  }

  // ========== List ==========

  list(): void {
    console.log('\n' + '='.repeat(60));
    console.log(`${this.config.sfObject} in Vault`);
    console.log('='.repeat(60) + '\n');

    if (!fs.existsSync(this.vaultDir)) {
      console.log(`  ℹ No ${this.objectName} directory found`);
      return;
    }

    const files = fs.readdirSync(this.vaultDir).filter(f => f.endsWith('.md'));

    if (files.length === 0) {
      console.log(`  ℹ No ${this.objectName} found`);
      return;
    }

    const records: Array<{ name: string; synced: boolean; sf_id: string | null; file: string }> = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.vaultDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = matter(content);
        const record = parsed.data;

        records.push({
          name: record.name || file.replace('.md', ''),
          synced: !!record.sf_id,
          sf_id: record.sf_id || null,
          file,
        });
      } catch (error) {
        console.warn(`  ⚠ Error reading ${file}:`, error);
      }
    }

    records.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Found ${records.length} record(s):\n`);
    console.log('  NAME                                SYNCED  SF ID');
    console.log('  ' + '-'.repeat(70));

    for (const rec of records) {
      const name = rec.name.padEnd(35).substring(0, 35);
      const synced = rec.synced ? '✓' : '✗';
      const sfId = rec.sf_id ? rec.sf_id.substring(0, 18) : '-';
      console.log(`  ${name} ${synced.padEnd(7)} ${sfId}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log(`  Total:      ${records.length}`);
    console.log(`  Synced:     ${records.filter(r => r.synced).length}`);
    console.log(`  Not Synced: ${records.filter(r => !r.synced).length}`);
    console.log('='.repeat(60) + '\n');
  }

  // ========== Status ==========

  printStatus(): void {
    console.log('\n' + '='.repeat(60));
    console.log(`${this.config.sfObject} Sync Status`);
    console.log('='.repeat(60));

    if (this.state.lastSync) {
      const lastSyncDate = new Date(this.state.lastSync);
      console.log(`\nLast Sync: ${lastSyncDate.toLocaleString()}`);
      console.log(`Direction: ${this.state.lastSyncDirection}`);
    } else {
      console.log('\nNever synced');
    }

    console.log('\nStatistics:');
    console.log(`  Total Loaded:     ${this.state.stats.totalLoaded}`);
    console.log(`  Total Saved:      ${this.state.stats.totalSaved}`);
    console.log(`  Last Load Count:  ${this.state.stats.lastLoadCount}`);
    console.log(`  Last Save Count:  ${this.state.stats.lastSaveCount}`);
    console.log(`  Total Errors:     ${this.state.stats.errors}`);
    console.log('='.repeat(60) + '\n');
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const objectOrAll = args[1];
  const fullSync = args.includes('--full');

  const availableObjects = Object.keys(OBJECT_CONFIGS);

  if (!command || !objectOrAll) {
    console.log('Usage: npx tsx scripts/sf-sync.ts <command> <object|all>');
    console.log('');
    console.log('Commands:');
    console.log('  load <object|all> [--full]   Load from Salesforce');
    console.log('  save <object|all>            Save to Salesforce');
    console.log('  list <object|all>            List records in vault');
    console.log('  status <object|all>          Show sync status');
    console.log('');
    console.log('Available objects:');
    availableObjects.forEach(obj => console.log(`  - ${obj}`));
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx scripts/sf-sync.ts load accounts        # Load accounts');
    console.log('  npx tsx scripts/sf-sync.ts load all             # Load all objects');
    console.log('  npx tsx scripts/sf-sync.ts load leads --full    # Full sync leads');
    console.log('  npx tsx scripts/sf-sync.ts save accounts        # Save accounts to SF');
    console.log('  npx tsx scripts/sf-sync.ts save all             # Save all to SF');
    console.log('  npx tsx scripts/sf-sync.ts list accounts        # List accounts in vault');
    console.log('  npx tsx scripts/sf-sync.ts status accounts      # Show account sync status');
    console.log('  npx tsx scripts/sf-sync.ts status all           # Show all sync statuses');
    process.exit(1);
  }

  const objects = objectOrAll === 'all' ? availableObjects : [objectOrAll];

  // Validate objects
  for (const obj of objects) {
    if (!OBJECT_CONFIGS[obj]) {
      console.error(`Error: Unknown object type "${obj}"`);
      console.log('\nAvailable objects:');
      availableObjects.forEach(o => console.log(`  - ${o}`));
      process.exit(1);
    }
  }

  // Execute command for each object
  const results: { object: string; success: boolean; error?: string }[] = [];

  for (const obj of objects) {
    const service = new GenericSyncService(obj);

    try {
      switch (command) {
        case 'load':
          await service.load(fullSync);
          results.push({ object: obj, success: true });
          break;

        case 'save':
          await service.save();
          results.push({ object: obj, success: true });
          break;

        case 'list':
          service.list();
          results.push({ object: obj, success: true });
          break;

        case 'status':
          service.printStatus();
          results.push({ object: obj, success: true });
          break;

        default:
          console.error(`Error: Unknown command "${command}"`);
          process.exit(1);
      }
    } catch (error: any) {
      console.error(`\n⚠️  Skipping ${obj}: ${error.message}\n`);
      results.push({ object: obj, success: false, error: error.message });
      // Continue with next object instead of exiting
    }
  }

  // Print summary if processing multiple objects
  if (objects.length > 1) {
    console.log('\n' + '='.repeat(60));
    console.log('Sync Summary');
    console.log('='.repeat(60));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\n✓ Successful: ${successful.length}/${results.length}`);
    successful.forEach(r => console.log(`  - ${r.object}`));

    if (failed.length > 0) {
      console.log(`\n✗ Failed: ${failed.length}/${results.length}`);
      failed.forEach(r => {
        const isOptional = OBJECT_CONFIGS[r.object]?.optional;
        const prefix = isOptional ? '  - [Optional]' : '  - [Required]';
        console.log(`${prefix} ${r.object}: ${r.error}`);
      });

      const requiredFailed = failed.filter(r => !OBJECT_CONFIGS[r.object]?.optional);
      if (requiredFailed.length > 0) {
        console.log(`\n⚠️  ${requiredFailed.length} required object(s) failed to sync`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { GenericSyncService, OBJECT_CONFIGS };
