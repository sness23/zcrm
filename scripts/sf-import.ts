#!/usr/bin/env tsx
/**
 * Salesforce to Zax CRM Importer
 *
 * Imports Salesforce records into Zax CRM by:
 * 1. Loading SF data (SOQL query or JSON file)
 * 2. Transforming fields according to mappings.yaml
 * 3. Building ID→Slug mapping (Pass 1)
 * 4. Resolving relationships to typed links (Pass 2)
 * 5. Posting events to Zax CRM API
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ulid } from 'ulidx';
import { exec } from 'child_process';
import { promisify } from 'util';
import matter from 'gray-matter';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

interface FieldMapping {
  target: string;
  type?: string;
  pattern?: string;
  format?: string;
  required?: boolean;
  to_body?: boolean;
  transform?: string;
  resolve?: {
    object?: string;
    link_field?: string;
    polymorphic?: boolean;
  };
}

interface ObjectMapping {
  fs_entity: string;
  id_prefix: string;
  fields: Record<string, FieldMapping>;
}

interface Mappings {
  global: {
    Id: FieldMapping;
    LastModifiedDate: FieldMapping;
    CreatedDate: FieldMapping;
    CreatedById: FieldMapping;
    LastModifiedById: FieldMapping;
    OwnerId: FieldMapping;
    skip_fields: string[];
  };
  objects: Record<string, ObjectMapping>;
  transformers?: Record<string, any>;
  resolution?: any;
}

interface SFRecord {
  Id: string;
  Name?: string;
  [key: string]: any;
}

interface FSRecord {
  id: string;
  type: string;
  name: string;
  sf_id: string;
  sf_synced_at: string;
  [key: string]: any;
}

interface ImportStats {
  object: string;
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{
    sfId: string;
    sfName?: string;
    error: string;
    record?: any;
  }>;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate ULID with entity prefix
 */
function generateId(prefix: string): string {
  return `${prefix}_${ulid().toLowerCase()}`;
}

/**
 * Convert string to kebab-case slug
 */
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // spaces to hyphens
    .replace(/[^\w\-]+/g, '')       // remove non-word chars
    .replace(/\-\-+/g, '-')         // multiple hyphens to single
    .replace(/^-+/, '')             // trim start
    .replace(/-+$/, '');            // trim end
}

/**
 * Convert PascalCase/camelCase to snake_case
 */
function toSnakeCase(text: string): string {
  return text
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Load YAML file
 */
function loadYaml<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(content) as T;
}

/**
 * Load JSON file
 */
function loadJson<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

// ============================================================================
// SF Data Loader
// ============================================================================

class SFDataLoader {
  constructor(private org: string = 'snessorg') {}

  /**
   * Query records using SF CLI
   */
  async queryRecords(objectName: string, fields?: string[]): Promise<SFRecord[]> {
    console.log(`Querying ${objectName} from Salesforce...`);

    // Build SOQL query
    const fieldList = fields?.join(', ') || '*';
    const soql = `SELECT ${fieldList} FROM ${objectName}`;

    try {
      const { stdout } = await execAsync(
        `sf data query -o ${this.org} -q "${soql}" --json`
      );

      const result = JSON.parse(stdout);
      if (result.status !== 0) {
        throw new Error(`SF CLI error: ${result.message}`);
      }

      const records = result.result?.records || [];
      console.log(`  ✓ Loaded ${records.length} ${objectName} records`);
      return records;
    } catch (error) {
      console.error(`  ✗ Failed to query ${objectName}:`, error);
      throw error;
    }
  }

  /**
   * Load records from JSON file (for testing or offline mode)
   */
  loadFromFile(filePath: string): SFRecord[] {
    console.log(`Loading records from ${filePath}...`);

    const data = loadJson<any>(filePath);

    // Handle different JSON formats
    let records: SFRecord[] = [];
    if (data.result?.records) {
      records = data.result.records;
    } else if (data.records) {
      records = data.records;
    } else if (Array.isArray(data)) {
      records = data;
    } else {
      throw new Error('Unknown JSON format');
    }

    console.log(`  ✓ Loaded ${records.length} records`);
    return records;
  }
}

// ============================================================================
// Field Transformer
// ============================================================================

class FieldTransformer {
  constructor(private mappings: Mappings) {}

  /**
   * Transform a single field value
   */
  transformField(value: any, mapping: FieldMapping): any {
    if (value === null || value === undefined) {
      return undefined;
    }

    // Apply type transformations
    switch (mapping.type) {
      case 'string':
        return String(value);

      case 'integer':
        return parseInt(value, 10);

      case 'number':
        return parseFloat(value);

      case 'boolean':
        return Boolean(value);

      case 'date':
        // SF dates: "2024-10-13"
        return value;

      case 'date-time':
        // SF datetimes: "2024-10-13T10:30:00.000+0000"
        // Convert to ISO8601
        return new Date(value).toISOString();

      default:
        return value;
    }
  }

  /**
   * Strip __c suffix from custom field names
   */
  normalizeFieldName(sfFieldName: string): string {
    if (sfFieldName.endsWith('__c')) {
      return toSnakeCase(sfFieldName.replace(/__c$/, ''));
    }
    return toSnakeCase(sfFieldName);
  }
}

// ============================================================================
// Record Transformer
// ============================================================================

class RecordTransformer {
  private transformer: FieldTransformer;
  private bodyFields: Set<string> = new Set();

  constructor(private mappings: Mappings) {
    this.transformer = new FieldTransformer(mappings);
  }

  /**
   * Transform SF record to Zax CRM record (Pass 1: no relationship resolution)
   */
  transform(
    sfRecord: SFRecord,
    objectName: string,
    objectMapping: ObjectMapping
  ): { record: FSRecord; body: string } {
    const fsRecord: any = {
      id: generateId(objectMapping.id_prefix),
      type: objectMapping.fs_entity,
    };

    let bodyContent = '';

    // Apply global field mappings
    this.applyGlobalMappings(sfRecord, fsRecord);

    // Apply object-specific field mappings
    for (const [sfField, mapping] of Object.entries(objectMapping.fields)) {
      const value = sfRecord[sfField];

      if (value === null || value === undefined) {
        continue;
      }

      // Check if field goes to body
      if (mapping.to_body) {
        bodyContent += `${value}\n\n`;
        continue;
      }

      // Transform and store
      const transformed = this.transformer.transformField(value, mapping);
      fsRecord[mapping.target] = transformed;

      // Store SF ID for relationship fields
      if (mapping.resolve) {
        const sfIdField = `${mapping.target}_sf_id`;
        if (!sfIdField.endsWith('_sf_id_sf_id')) {
          fsRecord[sfIdField] = value;
        }
      }
    }

    // Handle custom fields not in mapping
    this.handleCustomFields(sfRecord, fsRecord, objectMapping);

    // Set name field (required)
    if (!fsRecord.name) {
      fsRecord.name = sfRecord.Name || sfRecord.Subject || `${objectName}-${fsRecord.id}`;
    }

    return { record: fsRecord as FSRecord, body: bodyContent.trim() };
  }

  /**
   * Apply global field mappings (Id, timestamps, owner, etc.)
   */
  private applyGlobalMappings(sfRecord: SFRecord, fsRecord: any): void {
    const global = this.mappings.global;

    // Required: SF ID
    if (sfRecord.Id) {
      fsRecord.sf_id = sfRecord.Id;
    }

    // Timestamps
    if (sfRecord.CreatedDate) {
      fsRecord.created_at = new Date(sfRecord.CreatedDate).toISOString();
    }

    if (sfRecord.LastModifiedDate) {
      fsRecord.updated_at = new Date(sfRecord.LastModifiedDate).toISOString();
      fsRecord.sf_synced_at = new Date().toISOString();
    }

    // Audit fields
    if (sfRecord.CreatedById) {
      fsRecord.created_by_sf_id = sfRecord.CreatedById;
    }

    if (sfRecord.LastModifiedById) {
      fsRecord.updated_by_sf_id = sfRecord.LastModifiedById;
    }

    if (sfRecord.OwnerId) {
      fsRecord.owner_sf_id = sfRecord.OwnerId;
    }
  }

  /**
   * Handle custom fields not explicitly mapped
   */
  private handleCustomFields(
    sfRecord: SFRecord,
    fsRecord: any,
    objectMapping: ObjectMapping
  ): void {
    const skipFields = new Set([
      'Id', 'Name', 'CreatedDate', 'LastModifiedDate',
      'CreatedById', 'LastModifiedById', 'OwnerId',
      'SystemModstamp', 'IsDeleted', 'MasterRecordId',
      'LastActivityDate', 'LastViewedDate', 'LastReferencedDate',
      'attributes', // SF metadata
      ...this.mappings.global.skip_fields,
      ...Object.keys(objectMapping.fields),
    ]);

    for (const [sfField, value] of Object.entries(sfRecord)) {
      if (skipFields.has(sfField) || value === null || value === undefined) {
        continue;
      }

      // Custom field
      if (sfField.endsWith('__c')) {
        const fsField = this.transformer.normalizeFieldName(sfField);
        fsRecord[fsField] = value;
      }
    }
  }
}

// ============================================================================
// Relationship Resolver
// ============================================================================

class RelationshipResolver {
  private sfIdToSlug: Map<string, { slug: string; type: string }> = new Map();
  private objectMapping: Map<string, ObjectMapping> = new Map();

  constructor(private mappings: Mappings) {
    // Build object mapping lookup
    for (const [sfObject, mapping] of Object.entries(mappings.objects)) {
      this.objectMapping.set(sfObject, mapping);
    }
  }

  /**
   * Build ID → Slug mapping (Pass 1)
   */
  buildIdMap(records: FSRecord[], sfObject: string): void {
    const mapping = this.objectMapping.get(sfObject);
    if (!mapping) return;

    for (const record of records) {
      if (record.sf_id && record.name) {
        const slug = slugify(record.name);
        this.sfIdToSlug.set(record.sf_id, {
          slug,
          type: mapping.fs_entity,
        });
      }
    }
  }

  /**
   * Resolve relationships to typed links (Pass 2)
   */
  resolveLinks(record: FSRecord, objectName: string): FSRecord {
    const mapping = this.objectMapping.get(objectName);
    if (!mapping) return record;

    // Iterate through field mappings
    for (const [sfField, fieldMapping] of Object.entries(mapping.fields)) {
      if (!fieldMapping.resolve) continue;

      const sfIdField = `${fieldMapping.target}_sf_id`;
      const sfId = (record as any)[sfIdField];

      if (!sfId) continue;

      // Lookup slug
      const target = this.sfIdToSlug.get(sfId);
      if (!target) {
        console.warn(`  ⚠ Cannot resolve ${sfIdField}=${sfId} (target not found)`);
        continue;
      }

      // Create typed link
      const linkField = fieldMapping.resolve.link_field || fieldMapping.target;
      (record as any)[linkField] = `[[${target.type}:${target.slug}]]`;
    }

    // Handle polymorphic fields (WhoId, WhatId)
    this.resolvePolymorphicFields(record);

    return record;
  }

  /**
   * Resolve polymorphic relationship fields
   */
  private resolvePolymorphicFields(record: FSRecord): void {
    // WhoId (Contact or Lead)
    if ((record as any).who_sf_id) {
      const target = this.sfIdToSlug.get((record as any).who_sf_id);
      if (target) {
        (record as any).related_to = `[[${target.type}:${target.slug}]]`;
      }
    }

    // WhatId (Account, Opportunity, etc.)
    if ((record as any).what_sf_id) {
      const target = this.sfIdToSlug.get((record as any).what_sf_id);
      if (target) {
        (record as any).regarding = `[[${target.type}:${target.slug}]]`;
      }
    }
  }

  /**
   * Get stats
   */
  getStats(): { totalIds: number; totalObjects: number } {
    return {
      totalIds: this.sfIdToSlug.size,
      totalObjects: this.objectMapping.size,
    };
  }
}

// ============================================================================
// Event Emitter
// ============================================================================

class EventEmitter {
  constructor(
    private apiUrl: string = 'http://localhost:9600/api/events',
    private dryRun: boolean = false
  ) {}

  /**
   * Post events to Zax CRM API
   */
  async postEvents(records: FSRecord[], objectName: string): Promise<void> {
    if (this.dryRun) {
      console.log(`  [DRY RUN] Would post ${records.length} events to ${this.apiUrl}`);
      return;
    }

    console.log(`  Posting ${records.length} events to API...`);

    // Create events
    const events = records.map(record => ({
      type: 'create',
      entity: record.type,
      data: record,
    }));

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      console.log(`  ✓ Posted ${events.length} events`);
    } catch (error) {
      console.error(`  ✗ Failed to post events:`, error);
      throw error;
    }
  }
}

// ============================================================================
// SF Importer (Main)
// ============================================================================

class SFImporter {
  private loader: SFDataLoader;
  private transformer: RecordTransformer;
  private resolver: RelationshipResolver;
  private emitter: EventEmitter;

  constructor(
    private mappings: Mappings,
    private options: {
      org?: string;
      apiUrl?: string;
      dryRun?: boolean;
    } = {}
  ) {
    this.loader = new SFDataLoader(options.org);
    this.transformer = new RecordTransformer(mappings);
    this.resolver = new RelationshipResolver(mappings);
    this.emitter = new EventEmitter(options.apiUrl, options.dryRun);
  }

  /**
   * Import a single object type
   */
  async importObject(
    objectName: string,
    sourceFile?: string
  ): Promise<ImportStats> {
    const stats: ImportStats = {
      object: objectName,
      total: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Importing ${objectName}`);
      console.log('='.repeat(60));

      // Get object mapping
      const objectMapping = this.mappings.objects[objectName];
      if (!objectMapping) {
        throw new Error(`No mapping found for ${objectName}`);
      }

      // Load SF records
      const sfRecords = sourceFile
        ? this.loader.loadFromFile(sourceFile)
        : await this.loader.queryRecords(objectName);

      stats.total = sfRecords.length;

      if (sfRecords.length === 0) {
        console.log('  ℹ No records to import');
        return stats;
      }

      // Pass 1: Transform records
      console.log(`\nPass 1: Transforming ${sfRecords.length} records...`);
      const fsRecords: FSRecord[] = [];

      for (const sfRecord of sfRecords) {
        try {
          const { record, body } = this.transformer.transform(
            sfRecord,
            objectName,
            objectMapping
          );
          fsRecords.push(record);
        } catch (error) {
          stats.failed++;
          stats.errors.push({
            sfId: sfRecord.Id,
            sfName: sfRecord.Name,
            error: String(error),
            record: sfRecord,
          });
        }
      }

      console.log(`  ✓ Transformed ${fsRecords.length} records`);

      // Build ID → Slug mapping
      this.resolver.buildIdMap(fsRecords, objectName);

      stats.imported = fsRecords.length;

      // Post events (Pass 1 - without relationships)
      if (fsRecords.length > 0) {
        await this.emitter.postEvents(fsRecords, objectName);
      }

      return stats;
    } catch (error) {
      console.error(`✗ Failed to import ${objectName}:`, error);
      throw error;
    }
  }

  /**
   * Resolve all relationships (Pass 2)
   */
  async resolveAllRelationships(objects: string[]): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log('Pass 2: Resolving Relationships');
    console.log('='.repeat(60));

    const resolverStats = this.resolver.getStats();
    console.log(`\nID mapping: ${resolverStats.totalIds} IDs across ${resolverStats.totalObjects} object types`);

    if (resolverStats.totalIds === 0) {
      console.log('\n  ℹ No IDs in mapping - skipping Pass 2');
      return;
    }

    let totalUpdated = 0;
    let totalSkipped = 0;

    // Process each object type
    for (const objectName of objects) {
      const objectMapping = this.mappings.objects[objectName];
      if (!objectMapping) {
        console.log(`\n⚠ No mapping for ${objectName}, skipping`);
        continue;
      }

      const fsEntity = objectMapping.fs_entity;
      const vaultDir = path.join('vault', this.getVaultDir(fsEntity));

      if (!fs.existsSync(vaultDir)) {
        console.log(`\n⚠ Directory ${vaultDir} doesn't exist, skipping ${objectName}`);
        continue;
      }

      console.log(`\n🔗 Resolving ${objectName} relationships...`);

      // Read all markdown files in directory
      const files = fs.readdirSync(vaultDir)
        .filter(f => f.endsWith('.md'));

      if (files.length === 0) {
        console.log(`  ℹ No files found in ${vaultDir}`);
        continue;
      }

      console.log(`  Found ${files.length} records to process`);

      let updated = 0;
      let skipped = 0;

      for (const file of files) {
        try {
          const filePath = path.join(vaultDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const parsed = matter(content);
          const record = parsed.data as FSRecord;

          // Check if record has any SF ID fields to resolve
          const hasUnresolvedLinks = this.hasUnresolvedLinks(record, objectMapping);

          if (!hasUnresolvedLinks) {
            skipped++;
            continue;
          }

          // Resolve links
          const resolvedRecord = this.resolver.resolveLinks(record, objectName);

          // Check if any links were actually resolved
          const linksResolved = this.countResolvedLinks(record, resolvedRecord);

          if (linksResolved === 0) {
            skipped++;
            continue;
          }

          // Post update event
          await this.postUpdateEvent(resolvedRecord, linksResolved);
          updated++;

        } catch (error) {
          console.error(`  ✗ Error processing ${file}:`, error);
        }
      }

      console.log(`  ✓ Updated ${updated} records, skipped ${skipped}`);
      totalUpdated += updated;
      totalSkipped += skipped;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Pass 2 Complete:`);
    console.log(`  Records Updated: ${totalUpdated}`);
    console.log(`  Records Skipped: ${totalSkipped}`);
    console.log('='.repeat(60));
  }

  /**
   * Get vault directory name for entity type
   */
  private getVaultDir(entityType: string): string {
    const dirMap: Record<string, string> = {
      'Account': 'accounts',
      'Contact': 'contacts',
      'Lead': 'leads',
      'Opportunity': 'opportunities',
      'Campaign': 'campaigns',
      'Case': 'cases',
      'Activity': 'activities',
      'Product': 'products',
      'Task': 'tasks',
      'Event': 'events',
    };
    return dirMap[entityType] || entityType.toLowerCase() + 's';
  }

  /**
   * Check if record has unresolved relationship fields
   */
  private hasUnresolvedLinks(record: FSRecord, objectMapping: ObjectMapping): boolean {
    for (const [sfField, fieldMapping] of Object.entries(objectMapping.fields)) {
      if (!fieldMapping.resolve) continue;

      const sfIdField = `${fieldMapping.target}_sf_id`;
      const linkField = fieldMapping.resolve.link_field || fieldMapping.target;

      // Has SF ID but no link field
      if ((record as any)[sfIdField] && !(record as any)[linkField]) {
        return true;
      }
    }

    // Check polymorphic fields
    if ((record as any).who_sf_id && !(record as any).related_to) return true;
    if ((record as any).what_sf_id && !(record as any).regarding) return true;

    return false;
  }

  /**
   * Count how many links were resolved
   */
  private countResolvedLinks(oldRecord: FSRecord, newRecord: FSRecord): number {
    let count = 0;

    for (const [key, value] of Object.entries(newRecord)) {
      // Check if this is a new link field (starts with [[)
      if (typeof value === 'string' && value.startsWith('[[') && !(oldRecord as any)[key]) {
        count++;
      }
    }

    return count;
  }

  /**
   * Post update event for resolved links
   */
  private async postUpdateEvent(record: FSRecord, linksResolved: number): Promise<void> {
    if (this.options.dryRun) {
      return;
    }

    try {
      const event = {
        type: 'update',
        entity: record.type,
        entity_id: record.id,
        data: record,
        changes: `Resolved ${linksResolved} relationship link(s)`,
      };

      const response = await fetch(this.options.apiUrl || 'http://localhost:9600/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to post update event for ${record.id}:`, error);
      throw error;
    }
  }

  /**
   * Import multiple objects in order
   */
  async importAll(objects: string[]): Promise<Map<string, ImportStats>> {
    const results = new Map<string, ImportStats>();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`SF → Zax CRM Import`);
    console.log(`Objects: ${objects.join(', ')}`);
    console.log('='.repeat(60));

    // Pass 1: Import all objects
    for (const objectName of objects) {
      try {
        const stats = await this.importObject(objectName);
        results.set(objectName, stats);
      } catch (error) {
        console.error(`Failed to import ${objectName}:`, error);
      }
    }

    // Pass 2: Resolve relationships
    await this.resolveAllRelationships(objects);

    // Print summary
    this.printSummary(results);

    return results;
  }

  /**
   * Print import summary
   */
  private printSummary(results: Map<string, ImportStats>): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(60));

    let totalRecords = 0;
    let totalImported = 0;
    let totalFailed = 0;

    for (const [object, stats] of results.entries()) {
      console.log(`\n${object}:`);
      console.log(`  Total:    ${stats.total}`);
      console.log(`  Imported: ${stats.imported}`);
      console.log(`  Failed:   ${stats.failed}`);

      if (stats.errors.length > 0) {
        console.log(`  Errors:`);
        stats.errors.slice(0, 5).forEach(err => {
          console.log(`    - ${err.sfId}: ${err.error}`);
        });
        if (stats.errors.length > 5) {
          console.log(`    ... and ${stats.errors.length - 5} more`);
        }
      }

      totalRecords += stats.total;
      totalImported += stats.imported;
      totalFailed += stats.failed;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Total Records:  ${totalRecords}`);
    console.log(`Total Imported: ${totalImported}`);
    console.log(`Total Failed:   ${totalFailed}`);
    console.log('='.repeat(60));
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const options = {
    object: args.find(a => a.startsWith('--object='))?.split('=')[1],
    objects: args.find(a => a.startsWith('--objects='))?.split('=')[1]?.split(','),
    sourceFile: args.find(a => a.startsWith('--file='))?.split('=')[1],
    mappings: args.find(a => a.startsWith('--mappings='))?.split('=')[1] || 'sf/mappings.yaml',
    org: args.find(a => a.startsWith('--org='))?.split('=')[1] || 'snessorg',
    apiUrl: args.find(a => a.startsWith('--api='))?.split('=')[1] || 'http://localhost:9600/api/events',
    dryRun: args.includes('--dry-run'),
  };

  // Load mappings
  console.log(`Loading mappings from ${options.mappings}...`);
  const mappings = loadYaml<Mappings>(options.mappings);

  // Create importer
  const importer = new SFImporter(mappings, {
    org: options.org,
    apiUrl: options.apiUrl,
    dryRun: options.dryRun,
  });

  // Import
  if (options.object) {
    await importer.importObject(options.object, options.sourceFile);
  } else if (options.objects) {
    await importer.importAll(options.objects);
  } else {
    // Default: import core objects
    const coreObjects = ['Account', 'Contact', 'Lead', 'Opportunity', 'Campaign', 'Case'];
    await importer.importAll(coreObjects);
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { SFImporter, RelationshipResolver, RecordTransformer, FieldTransformer };
