#!/usr/bin/env tsx
/**
 * Extend FS-CRM schemas with Salesforce-specific fields
 * Adds sf_id, sf_synced_at, and other SF tracking fields to all schemas
 */

import * as fs from 'fs';
import * as path from 'path';

const SCHEMAS_DIR = 'vault/_schemas';

// Common SF fields to add to all entity schemas
const SF_COMMON_FIELDS = {
  sf_id: {
    type: 'string',
    pattern: '^[a-zA-Z0-9]{18}$',
    description: 'Original Salesforce 18-character ID',
  },
  sf_synced_at: {
    type: 'string',
    format: 'date-time',
    description: 'Last sync timestamp from Salesforce',
  },
  created_at: {
    type: 'string',
    format: 'date-time',
    description: 'Record creation timestamp',
  },
  updated_at: {
    type: 'string',
    format: 'date-time',
    description: 'Record last modification timestamp',
  },
  created_by_sf_id: {
    type: 'string',
    description: 'Salesforce User ID who created this record',
  },
  updated_by_sf_id: {
    type: 'string',
    description: 'Salesforce User ID who last modified this record',
  },
  owner_sf_id: {
    type: 'string',
    description: 'Salesforce User ID of the record owner',
  },
};

// Entity-specific fields based on SF standard schema
const ENTITY_SPECIFIC_FIELDS: Record<string, any> = {
  Contact: {
    first_name: { type: 'string' },
    last_name: { type: 'string' },
    title: { type: 'string' },
    department: { type: 'string' },
    email: { type: 'string', format: 'email' },
    phone: { type: 'string' },
    mobile_phone: { type: 'string' },
    fax: { type: 'string' },
    account_sf_id: { type: 'string', description: 'SF Account ID' },
    account: { type: 'string', description: 'Typed link: [[Account:slug]]' },
    reports_to_sf_id: { type: 'string' },
    reports_to: { type: 'string', description: 'Typed link: [[Contact:slug]]' },
    mailing_street: { type: 'string' },
    mailing_city: { type: 'string' },
    mailing_state: { type: 'string' },
    mailing_postal_code: { type: 'string' },
    mailing_country: { type: 'string' },
  },
  Lead: {
    first_name: { type: 'string' },
    last_name: { type: 'string' },
    company: { type: 'string' },
    title: { type: 'string' },
    email: { type: 'string', format: 'email' },
    phone: { type: 'string' },
    mobile_phone: { type: 'string' },
    website: { type: 'string' },
    lead_source: { type: 'string' },
    status: { type: 'string' },
    rating: { type: 'string' },
    industry: { type: 'string' },
    employee_count: { type: 'integer' },
    annual_revenue: { type: 'number' },
    street: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    postal_code: { type: 'string' },
    country: { type: 'string' },
  },
  Opportunity: {
    account_sf_id: { type: 'string' },
    account: { type: 'string', description: 'Typed link: [[Account:slug]]' },
    amount: { type: 'number' },
    close_date: { type: 'string', format: 'date' },
    stage: { type: 'string' },
    probability: { type: 'integer' },
    opportunity_type: { type: 'string' },
    lead_source: { type: 'string' },
    next_step: { type: 'string' },
    forecast_category: { type: 'string' },
    is_closed: { type: 'boolean' },
    is_won: { type: 'boolean' },
  },
  Campaign: {
    campaign_type: { type: 'string' },
    status: { type: 'string' },
    start_date: { type: 'string', format: 'date' },
    end_date: { type: 'string', format: 'date' },
    expected_revenue: { type: 'number' },
    budgeted_cost: { type: 'number' },
    actual_cost: { type: 'number' },
    expected_response: { type: 'number' },
    number_sent: { type: 'integer' },
    is_active: { type: 'boolean' },
    parent_campaign_sf_id: { type: 'string' },
    parent_campaign: { type: 'string', description: 'Typed link: [[Campaign:slug]]' },
  },
  Case: {
    case_number: { type: 'string' },
    status: { type: 'string' },
    priority: { type: 'string' },
    case_type: { type: 'string' },
    reason: { type: 'string' },
    origin: { type: 'string' },
    account_sf_id: { type: 'string' },
    account: { type: 'string', description: 'Typed link: [[Account:slug]]' },
    contact_sf_id: { type: 'string' },
    contact: { type: 'string', description: 'Typed link: [[Contact:slug]]' },
    parent_case_sf_id: { type: 'string' },
    parent_case: { type: 'string', description: 'Typed link: [[Case:slug]]' },
    is_closed: { type: 'boolean' },
  },
  Activity: {
    status: { type: 'string' },
    priority: { type: 'string' },
    due_date: { type: 'string', format: 'date' },
    start_time: { type: 'string', format: 'date-time' },
    end_time: { type: 'string', format: 'date-time' },
    duration_minutes: { type: 'integer' },
    location: { type: 'string' },
    is_all_day: { type: 'boolean' },
    is_completed: { type: 'boolean' },
    who_sf_id: { type: 'string', description: 'Polymorphic: Contact/Lead SF ID' },
    what_sf_id: { type: 'string', description: 'Polymorphic: Account/Opportunity SF ID' },
    related_to: { type: 'string', description: 'Typed link (polymorphic)' },
    regarding: { type: 'string', description: 'Typed link (polymorphic)' },
  },
  Task: {
    status: { type: 'string' },
    priority: { type: 'string' },
    due_date: { type: 'string', format: 'date' },
    is_completed: { type: 'boolean' },
    who_sf_id: { type: 'string' },
    what_sf_id: { type: 'string' },
    related_to: { type: 'string' },
    regarding: { type: 'string' },
  },
  Event: {
    start_time: { type: 'string', format: 'date-time' },
    end_time: { type: 'string', format: 'date-time' },
    duration_minutes: { type: 'integer' },
    location: { type: 'string' },
    is_all_day: { type: 'boolean' },
    who_sf_id: { type: 'string' },
    what_sf_id: { type: 'string' },
    related_to: { type: 'string' },
    regarding: { type: 'string' },
  },
  Product: {
    product_code: { type: 'string' },
    is_active: { type: 'boolean' },
    product_family: { type: 'string' },
  },
  Contract: {
    account_sf_id: { type: 'string' },
    account: { type: 'string', description: 'Typed link: [[Account:slug]]' },
    status: { type: 'string' },
    start_date: { type: 'string', format: 'date' },
    end_date: { type: 'string', format: 'date' },
    contract_term: { type: 'integer' },
    billing_street: { type: 'string' },
    billing_city: { type: 'string' },
    billing_state: { type: 'string' },
    billing_postal_code: { type: 'string' },
    billing_country: { type: 'string' },
  },
  Asset: {
    account_sf_id: { type: 'string' },
    account: { type: 'string', description: 'Typed link: [[Account:slug]]' },
    contact_sf_id: { type: 'string' },
    contact: { type: 'string', description: 'Typed link: [[Contact:slug]]' },
    product_sf_id: { type: 'string' },
    product: { type: 'string', description: 'Typed link: [[Product:slug]]' },
    status: { type: 'string' },
    serial_number: { type: 'string' },
    install_date: { type: 'string', format: 'date' },
    purchase_date: { type: 'string', format: 'date' },
    is_competitor_product: { type: 'boolean' },
  },
  Order: {
    account_sf_id: { type: 'string' },
    account: { type: 'string', description: 'Typed link: [[Account:slug]]' },
    contract_sf_id: { type: 'string' },
    contract: { type: 'string', description: 'Typed link: [[Contract:slug]]' },
    status: { type: 'string' },
    effective_date: { type: 'string', format: 'date' },
    order_number: { type: 'string' },
    total_amount: { type: 'number' },
  },
  Quote: {
    opportunity_sf_id: { type: 'string' },
    opportunity: { type: 'string', description: 'Typed link: [[Opportunity:slug]]' },
    status: { type: 'string' },
    expiration_date: { type: 'string', format: 'date' },
    quote_number: { type: 'string' },
    total_price: { type: 'number' },
  },
};

function extendSchema(schemaPath: string): void {
  const content = fs.readFileSync(schemaPath, 'utf-8');
  const schema = JSON.parse(content);

  // Determine entity type from schema
  const entityType = schema.properties?.type?.const || path.basename(schemaPath, '.schema.json');

  console.log(`Extending schema: ${entityType}`);

  // Skip if already has sf_id
  if (schema.properties?.sf_id) {
    console.log(`  ↳ Already extended (has sf_id), skipping`);
    return;
  }

  // Add common SF fields
  Object.entries(SF_COMMON_FIELDS).forEach(([key, value]) => {
    if (!schema.properties[key]) {
      schema.properties[key] = value;
    }
  });

  // Add entity-specific SF fields
  const entityFields = ENTITY_SPECIFIC_FIELDS[entityType];
  if (entityFields) {
    Object.entries(entityFields).forEach(([key, value]) => {
      if (!schema.properties[key]) {
        schema.properties[key] = value;
      }
    });
  }

  // Ensure additionalProperties is true
  schema.additionalProperties = true;

  // Write updated schema
  fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2) + '\n');
  console.log(`  ✓ Extended with ${Object.keys(SF_COMMON_FIELDS).length} common + ${Object.keys(entityFields || {}).length} specific fields`);
}

function main() {
  console.log('Extending FS-CRM schemas with Salesforce fields...\n');

  // Get all schema files
  const files = fs.readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.schema.json'));

  files.forEach(file => {
    const schemaPath = path.join(SCHEMAS_DIR, file);
    try {
      extendSchema(schemaPath);
    } catch (err) {
      console.error(`Error extending ${file}:`, err);
    }
  });

  console.log(`\n✓ Extended ${files.length} schemas`);
}

main();
