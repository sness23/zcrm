#!/usr/bin/env tsx
/**
 * Salesforce Lead Sync
 *
 * Simple bi-directional sync for Lead objects:
 * - Load: Pull changes from SF (LastModifiedDate > watermark)
 * - Save: Push changes to SF
 *
 * Usage:
 *   npx tsx scripts/sf-sync-leads.ts load
 *   npx tsx scripts/sf-sync-leads.ts save
 *   npx tsx scripts/sf-sync-leads.ts status
 */

import * as fs from 'fs';
import * as path from 'path';
import { ulid } from 'ulidx';
import { exec } from 'child_process';
import { promisify } from 'util';
import matter from 'gray-matter';
import * as yaml from 'js-yaml';

const execAsync = promisify(exec);

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  org: process.env.SF_ORG || 'snessorg',
  vaultDir: path.join(process.cwd(), 'vault', 'leads'),
  stateFile: path.join(process.cwd(), 'sf', 'sync-state-leads.json'),
  mappingsFile: path.join(process.cwd(), 'sf', 'mappings.yaml'),
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

interface SFLead {
  Id: string;
  FirstName?: string;
  LastName: string;
  Name: string;
  Company: string;
  Title?: string;
  Email?: string;
  Phone?: string;
  MobilePhone?: string;
  Website?: string;
  LeadSource?: string;
  Status?: string;
  Rating?: string;
  Industry?: string;
  NumberOfEmployees?: number;
  AnnualRevenue?: number;
  Description?: string;
  Street?: string;
  City?: string;
  State?: string;
  PostalCode?: string;
  Country?: string;
  OwnerId?: string;
  CreatedDate: string;
  LastModifiedDate: string;
  CreatedById?: string;
  LastModifiedById?: string;
}

interface FSLead {
  id: string;
  type: 'Lead';
  name: string;
  first_name?: string;
  last_name: string;
  company: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile_phone?: string;
  website?: string;
  lead_source?: string;
  status?: string;
  rating?: string;
  industry?: string;
  employee_count?: number;
  annual_revenue?: number;
  description?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  sf_id: string;
  sf_synced_at: string;
  created_at: string;
  updated_at: string;
  created_by_sf_id?: string;
  updated_by_sf_id?: string;
  owner_sf_id?: string;
}

// ============================================================================
// State Management
// ============================================================================

class StateManager {
  private state: SyncState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): SyncState {
    if (fs.existsSync(CONFIG.stateFile)) {
      const content = fs.readFileSync(CONFIG.stateFile, 'utf-8');
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

  saveState(): void {
    const dir = path.dirname(CONFIG.stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(CONFIG.stateFile, JSON.stringify(this.state, null, 2));
  }

  getLastSync(): string | null {
    return this.state.lastSync;
  }

  updateLastSync(direction: 'load' | 'save', count: number): void {
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

  incrementError(): void {
    this.state.stats.errors++;
    this.saveState();
  }

  getStats(): SyncState['stats'] {
    return this.state.stats;
  }

  printStatus(): void {
    console.log('\n' + '='.repeat(60));
    console.log('Lead Sync Status');
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
// Salesforce Loader
// ============================================================================

class SFLeadLoader {
  /**
   * Query Lead objects from Salesforce with optional date filter
   */
  async queryLeads(sinceDate?: string): Promise<SFLead[]> {
    console.log('Querying Leads from Salesforce...');

    // Build SOQL query
    const fields = [
      'Id',
      'FirstName',
      'LastName',
      'Name',
      'Company',
      'Title',
      'Email',
      'Phone',
      'MobilePhone',
      'Website',
      'LeadSource',
      'Status',
      'Rating',
      'Industry',
      'NumberOfEmployees',
      'AnnualRevenue',
      'Description',
      'Street',
      'City',
      'State',
      'PostalCode',
      'Country',
      'OwnerId',
      'CreatedDate',
      'LastModifiedDate',
      'CreatedById',
      'LastModifiedById',
    ];

    let soql = `SELECT ${fields.join(', ')} FROM Lead`;

    // Add date filter for incremental sync
    if (sinceDate) {
      soql += ` WHERE LastModifiedDate > ${sinceDate}`;
    }

    soql += ' ORDER BY LastModifiedDate ASC';

    try {
      console.log(`  SOQL: ${soql}`);

      const { stdout } = await execAsync(
        `sf data query -o ${CONFIG.org} -q "${soql}" --json`
      );

      const result = JSON.parse(stdout);

      if (result.status !== 0) {
        throw new Error(`SF CLI error: ${result.message || 'Unknown error'}`);
      }

      const records = result.result?.records || [];
      console.log(`  ✓ Loaded ${records.length} Lead records`);

      return records;
    } catch (error: any) {
      console.error('  ✗ Failed to query Leads:', error.message);
      throw error;
    }
  }
}

// ============================================================================
// Lead Transformer
// ============================================================================

class LeadTransformer {
  /**
   * Transform SF Lead → FS-CRM Lead
   */
  transform(sfLead: SFLead): FSLead {
    const slug = this.slugify(sfLead.Name);

    return {
      id: `led_${ulid().toLowerCase()}`,
      type: 'Lead',
      name: sfLead.Name,
      first_name: sfLead.FirstName,
      last_name: sfLead.LastName,
      company: sfLead.Company,
      title: sfLead.Title,
      email: sfLead.Email,
      phone: sfLead.Phone,
      mobile_phone: sfLead.MobilePhone,
      website: sfLead.Website,
      lead_source: sfLead.LeadSource,
      status: sfLead.Status,
      rating: sfLead.Rating,
      industry: sfLead.Industry,
      employee_count: sfLead.NumberOfEmployees,
      annual_revenue: sfLead.AnnualRevenue,
      description: sfLead.Description,
      street: sfLead.Street,
      city: sfLead.City,
      state: sfLead.State,
      postal_code: sfLead.PostalCode,
      country: sfLead.Country,
      sf_id: sfLead.Id,
      sf_synced_at: new Date().toISOString(),
      created_at: new Date(sfLead.CreatedDate).toISOString(),
      updated_at: new Date(sfLead.LastModifiedDate).toISOString(),
      created_by_sf_id: sfLead.CreatedById,
      updated_by_sf_id: sfLead.LastModifiedById,
      owner_sf_id: sfLead.OwnerId,
    };
  }

  /**
   * Check if lead already exists locally
   */
  findExisting(sfId: string): { filePath: string; lead: FSLead } | null {
    if (!fs.existsSync(CONFIG.vaultDir)) {
      return null;
    }

    const files = fs.readdirSync(CONFIG.vaultDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(CONFIG.vaultDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = matter(content);
      const lead = parsed.data as FSLead;

      if (lead.sf_id === sfId) {
        return { filePath, lead };
      }
    }

    return null;
  }

  /**
   * Write lead to vault
   */
  writeToVault(lead: FSLead): void {
    if (!fs.existsSync(CONFIG.vaultDir)) {
      fs.mkdirSync(CONFIG.vaultDir, { recursive: true });
    }

    const slug = this.slugify(lead.name);
    const filename = `${slug}.md`;
    const filePath = path.join(CONFIG.vaultDir, filename);

    // Build markdown content
    const body = lead.description
      ? `# ${lead.name}\n\n${lead.description}\n`
      : `# ${lead.name}\n`;

    // Remove undefined, null values and description from frontmatter
    const frontmatter: any = {};
    for (const [key, value] of Object.entries(lead)) {
      if (value !== undefined && value !== null && key !== 'description') {
        frontmatter[key] = value;
      }
    }

    const fileContent = matter.stringify(body, frontmatter);

    fs.writeFileSync(filePath, fileContent, 'utf-8');
    console.log(`  ✓ Written: ${filename}`);
  }

  /**
   * Post create/update event to API (optional - non-fatal if it fails)
   */
  async postEvent(
    lead: FSLead,
    eventType: 'create' | 'update'
  ): Promise<void> {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: eventType,
          entity_type: 'Lead',
          entity_id: lead.id,
          data: lead,
        }),
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      console.log(`  ✓ Event posted: ${eventType} ${lead.id}`);
    } catch (error: any) {
      // API not available - log but don't fail the sync
      console.log(`  ℹ Event API unavailable (continuing...)`);
    }
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
}

// ============================================================================
// Sync Service
// ============================================================================

class LeadSyncService {
  private state: StateManager;
  private loader: SFLeadLoader;
  private transformer: LeadTransformer;

  constructor() {
    this.state = new StateManager();
    this.loader = new SFLeadLoader();
    this.transformer = new LeadTransformer();
  }

  /**
   * Load leads from Salesforce → FS-CRM
   */
  async load(fullSync: boolean = false): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('Loading Leads from Salesforce');
    console.log('='.repeat(60) + '\n');

    try {
      // Get last sync timestamp for incremental sync
      const lastSync = fullSync ? null : this.state.getLastSync();

      if (lastSync) {
        console.log(`Incremental sync since: ${new Date(lastSync).toLocaleString()}`);
      } else {
        console.log('Full sync (no previous sync found)');
      }

      // Query SF
      const sfLeads = await this.loader.queryLeads(lastSync);

      if (sfLeads.length === 0) {
        console.log('\n  ℹ No leads to sync');
        return;
      }

      console.log(`\nProcessing ${sfLeads.length} lead(s)...\n`);

      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const sfLead of sfLeads) {
        try {
          // Check if lead exists
          const existing = this.transformer.findExisting(sfLead.Id);

          if (existing) {
            // Update existing
            console.log(`Updating: ${sfLead.Name}`);
            const fsLead = {
              ...existing.lead,
              name: sfLead.Name,
              first_name: sfLead.FirstName,
              last_name: sfLead.LastName,
              company: sfLead.Company,
              title: sfLead.Title,
              email: sfLead.Email,
              phone: sfLead.Phone,
              mobile_phone: sfLead.MobilePhone,
              website: sfLead.Website,
              lead_source: sfLead.LeadSource,
              status: sfLead.Status,
              rating: sfLead.Rating,
              industry: sfLead.Industry,
              employee_count: sfLead.NumberOfEmployees,
              annual_revenue: sfLead.AnnualRevenue,
              description: sfLead.Description,
              street: sfLead.Street,
              city: sfLead.City,
              state: sfLead.State,
              postal_code: sfLead.PostalCode,
              country: sfLead.Country,
              sf_synced_at: new Date().toISOString(),
              updated_at: new Date(sfLead.LastModifiedDate).toISOString(),
              updated_by_sf_id: sfLead.LastModifiedById,
              owner_sf_id: sfLead.OwnerId,
            };

            this.transformer.writeToVault(fsLead);
            await this.transformer.postEvent(fsLead, 'update');
            updated++;
          } else {
            // Create new
            console.log(`Creating: ${sfLead.Name}`);
            const fsLead = this.transformer.transform(sfLead);

            this.transformer.writeToVault(fsLead);
            await this.transformer.postEvent(fsLead, 'create');
            created++;
          }
        } catch (error: any) {
          console.error(`  ✗ Error processing ${sfLead.Name}:`, error.message);
          errors++;
          this.state.incrementError();
        }
      }

      // Update state
      this.state.updateLastSync('load', created + updated);

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

  /**
   * Save leads from FS-CRM → Salesforce
   */
  async save(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('Saving Leads to Salesforce');
    console.log('='.repeat(60) + '\n');

    try {
      // Get last sync timestamp
      const lastSync = this.state.getLastSync();

      if (lastSync) {
        console.log(`Finding leads modified since: ${new Date(lastSync).toLocaleString()}`);
      } else {
        console.log('No previous sync - will save all leads');
      }

      // Find modified leads
      const modifiedLeads = this.findModifiedLeads(lastSync);

      if (modifiedLeads.length === 0) {
        console.log('\n  ℹ No leads to save');
        return;
      }

      console.log(`\nProcessing ${modifiedLeads.length} lead(s)...\n`);

      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const { lead, filePath } of modifiedLeads) {
        try {
          // Update the updated_at timestamp before syncing
          lead.updated_at = new Date().toISOString();

          if (lead.sf_id) {
            // Update existing SF record
            console.log(`Updating in SF: ${lead.name} (${lead.sf_id})`);
            await this.updateInSalesforce(lead);
            updated++;
          } else {
            // Create new SF record
            console.log(`Creating in SF: ${lead.name}`);
            const sfId = await this.createInSalesforce(lead);

            // Update local file with SF ID
            lead.sf_id = sfId;
            lead.sf_synced_at = new Date().toISOString();
            this.transformer.writeToVault(lead);

            console.log(`  ✓ Created with SF ID: ${sfId}`);
            created++;
          }
        } catch (error: any) {
          console.error(`  ✗ Error processing ${lead.name}:`, error.message);
          errors++;
          this.state.incrementError();
        }
      }

      // Update state
      this.state.updateLastSync('save', created + updated);

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

  /**
   * Find leads modified since last sync
   */
  private findModifiedLeads(
    sinceDate: string | null
  ): Array<{ lead: FSLead; filePath: string }> {
    if (!fs.existsSync(CONFIG.vaultDir)) {
      return [];
    }

    const results: Array<{ lead: FSLead; filePath: string }> = [];
    const files = fs.readdirSync(CONFIG.vaultDir).filter(f => f.endsWith('.md'));

    const cutoffDate = sinceDate ? new Date(sinceDate) : new Date(0);

    for (const file of files) {
      try {
        const filePath = path.join(CONFIG.vaultDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = matter(content);
        const lead = parsed.data as FSLead;

        // Check both the updated_at field AND filesystem modification time
        const updatedAt = new Date(lead.updated_at || lead.created_at);
        const stats = fs.statSync(filePath);
        const fileModTime = stats.mtime;

        // Use the newer of the two timestamps
        const lastModified = updatedAt > fileModTime ? updatedAt : fileModTime;

        if (lastModified > cutoffDate) {
          results.push({ lead, filePath });
        }
      } catch (error) {
        console.warn(`  ⚠ Error reading ${file}:`, error);
      }
    }

    return results;
  }

  /**
   * Parse full name into first/last name
   */
  private parseFullName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return { firstName: '', lastName: parts[0] };
    }
    const lastName = parts.pop() || '';
    const firstName = parts.join(' ');
    return { firstName, lastName };
  }

  /**
   * Create lead in Salesforce
   */
  private async createInSalesforce(lead: FSLead): Promise<string> {
    // Derive first/last name from full name if not provided
    const { firstName, lastName } = lead.first_name && lead.last_name
      ? { firstName: lead.first_name, lastName: lead.last_name }
      : this.parseFullName(lead.name);

    const sfData: any = {
      FirstName: firstName,
      LastName: lastName,
      Company: lead.company,
      Title: lead.title,
      Email: lead.email,
      Phone: lead.phone,
      MobilePhone: lead.mobile_phone,
      Website: lead.website,
      LeadSource: lead.lead_source,
      Status: lead.status,
      Rating: lead.rating,
      Industry: lead.industry,
      NumberOfEmployees: lead.employee_count,
      AnnualRevenue: lead.annual_revenue,
      Description: lead.description,
      Street: lead.street,
      City: lead.city,
      State: lead.state,
      PostalCode: lead.postal_code,
      Country: lead.country,
    };

    // Remove undefined fields
    Object.keys(sfData).forEach(key => {
      if (sfData[key] === undefined) {
        delete sfData[key];
      }
    });

    // Build key=value pairs for SF CLI
    const pairs: string[] = [];
    for (const [key, value] of Object.entries(sfData)) {
      if (typeof value === 'string') {
        pairs.push(`${key}='${value.replace(/'/g, "\\'")}'`);
      } else {
        pairs.push(`${key}=${value}`);
      }
    }
    const sfDataString = pairs.join(' ');

    try {
      const { stdout } = await execAsync(
        `sf data create record -o ${CONFIG.org} -s Lead -v "${sfDataString}" --json`
      );

      const result = JSON.parse(stdout);

      if (result.status !== 0 || !result.result?.success) {
        throw new Error(result.message || 'Failed to create record');
      }

      return result.result.id;
    } catch (error: any) {
      console.error('  SF CLI output:', error.stdout || error.message);
      throw new Error(`Failed to create in SF: ${error.message}`);
    }
  }

  /**
   * Update lead in Salesforce
   */
  private async updateInSalesforce(lead: FSLead): Promise<void> {
    // Derive first/last name from full name if not provided
    const { firstName, lastName } = lead.first_name && lead.last_name
      ? { firstName: lead.first_name, lastName: lead.last_name }
      : this.parseFullName(lead.name);

    const sfData: any = {
      FirstName: firstName,
      LastName: lastName,
      Company: lead.company,
      Title: lead.title,
      Email: lead.email,
      Phone: lead.phone,
      MobilePhone: lead.mobile_phone,
      Website: lead.website,
      LeadSource: lead.lead_source,
      Status: lead.status,
      Rating: lead.rating,
      Industry: lead.industry,
      NumberOfEmployees: lead.employee_count,
      AnnualRevenue: lead.annual_revenue,
      Description: lead.description,
      Street: lead.street,
      City: lead.city,
      State: lead.state,
      PostalCode: lead.postal_code,
      Country: lead.country,
    };

    // Remove undefined fields
    Object.keys(sfData).forEach(key => {
      if (sfData[key] === undefined) {
        delete sfData[key];
      }
    });

    // Build key=value pairs for SF CLI
    const pairs: string[] = [];
    for (const [key, value] of Object.entries(sfData)) {
      if (typeof value === 'string') {
        pairs.push(`${key}='${value.replace(/'/g, "\\'")}'`);
      } else {
        pairs.push(`${key}=${value}`);
      }
    }
    const sfDataString = pairs.join(' ');

    try {
      const { stdout } = await execAsync(
        `sf data update record -o ${CONFIG.org} -s Lead -i ${lead.sf_id} -v "${sfDataString}" --json`
      );

      const result = JSON.parse(stdout);

      if (result.status !== 0 || !result.result?.success) {
        throw new Error(result.message || 'Failed to update record');
      }

      console.log(`  ✓ Updated in SF`);

      // Update local sync timestamp
      lead.sf_synced_at = new Date().toISOString();
      this.transformer.writeToVault(lead);
    } catch (error: any) {
      console.error('  SF CLI output:', error.stdout || error.message);
      throw new Error(`Failed to update in SF: ${error.message}`);
    }
  }

  /**
   * Show sync status
   */
  status(): void {
    this.state.printStatus();
  }

  /**
   * List all leads in vault
   */
  list(): void {
    console.log('\n' + '='.repeat(60));
    console.log('Leads in Vault');
    console.log('='.repeat(60) + '\n');

    if (!fs.existsSync(CONFIG.vaultDir)) {
      console.log('  ℹ No leads directory found');
      return;
    }

    const files = fs.readdirSync(CONFIG.vaultDir).filter(f => f.endsWith('.md'));

    if (files.length === 0) {
      console.log('  ℹ No leads found');
      return;
    }

    const leads: Array<{
      name: string;
      company: string;
      email: string;
      status: string;
      synced: boolean;
      sf_id: string | null;
      last_sync: string | null;
      file: string;
    }> = [];

    for (const file of files) {
      try {
        const filePath = path.join(CONFIG.vaultDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = matter(content);
        const lead = parsed.data as FSLead;

        leads.push({
          name: lead.name || file.replace('.md', ''),
          company: lead.company || '-',
          email: lead.email || '-',
          status: lead.status || '-',
          synced: !!lead.sf_id,
          sf_id: lead.sf_id || null,
          last_sync: lead.sf_synced_at || null,
          file: file,
        });
      } catch (error) {
        console.warn(`  ⚠ Error reading ${file}:`, error);
      }
    }

    // Sort by name
    leads.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Found ${leads.length} lead(s):\n`);

    // Print table header
    console.log('  NAME                      COMPANY              EMAIL                STATUS      SYNCED  SF ID');
    console.log('  ' + '-'.repeat(100));

    // Print leads
    for (const lead of leads) {
      const name = lead.name.padEnd(25).substring(0, 25);
      const company = lead.company.padEnd(20).substring(0, 20);
      const email = lead.email.padEnd(20).substring(0, 20);
      const status = lead.status.padEnd(11).substring(0, 11);
      const synced = lead.synced ? '✓' : '✗';
      const sfId = lead.sf_id ? lead.sf_id.substring(0, 18) : '-';

      console.log(`  ${name} ${company} ${email} ${status} ${synced.padEnd(7)} ${sfId}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log(`  Total Leads:     ${leads.length}`);
    console.log(`  Synced:          ${leads.filter(l => l.synced).length}`);
    console.log(`  Not Synced:      ${leads.filter(l => !l.synced).length}`);
    console.log('='.repeat(60) + '\n');
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';
  const fullSync = args.includes('--full');

  const service = new LeadSyncService();

  switch (command) {
    case 'load':
      await service.load(fullSync);
      break;

    case 'save':
      await service.save();
      break;

    case 'status':
      service.status();
      break;

    case 'list':
      service.list();
      break;

    default:
      console.log('Usage: npx tsx scripts/sf-sync-leads.ts <command>');
      console.log('');
      console.log('Commands:');
      console.log('  load [--full]   Load leads from Salesforce');
      console.log('  save            Save leads to Salesforce');
      console.log('  list            List all leads in vault');
      console.log('  status          Show sync status');
      console.log('');
      console.log('Examples:');
      console.log('  npx tsx scripts/sf-sync-leads.ts load         # Incremental sync');
      console.log('  npx tsx scripts/sf-sync-leads.ts load --full  # Full sync');
      console.log('  npx tsx scripts/sf-sync-leads.ts save         # Save to Salesforce');
      console.log('  npx tsx scripts/sf-sync-leads.ts list         # List leads');
      console.log('  npx tsx scripts/sf-sync-leads.ts status       # Show sync stats');
      process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { LeadSyncService, LeadTransformer, SFLeadLoader, StateManager };
