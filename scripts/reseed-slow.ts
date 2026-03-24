#!/usr/bin/env tsx
/**
 * Slow Reseed Orchestrator for FS-CRM
 * Resets data and then creates records one at a time with full processing
 * After each record: creates event → processes to markdown → syncs to database
 * Useful for watching the complete data flow in real-time
 */

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ulid } from 'ulidx';

const API_URL = 'http://localhost:9600';
const DELAY_MS = 1000; // 1 second delay between records

// ID generators for each entity type
function generateId(prefix: string): string {
  return `${prefix}_${ulid().toLowerCase()}`;
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Random data generators
const firstNames = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'William', 'Mia', 'James', 'Charlotte', 'Benjamin', 'Amelia', 'Lucas', 'Harper', 'Henry', 'Evelyn', 'Alexander'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const companyNames = ['Tech', 'Global', 'Digital', 'Innovative', 'Smart', 'Cloud', 'Data', 'Cyber', 'Next', 'Future', 'Prime', 'Elite', 'Advanced', 'Dynamic', 'Strategic', 'Quantum', 'Stellar', 'Apex', 'Zenith', 'Nexus'];
const companySuffixes = ['Solutions', 'Systems', 'Technologies', 'Enterprises', 'Group', 'Corp', 'Industries', 'Partners', 'Ventures', 'Labs', 'Inc', 'Dynamics', 'Innovations', 'Services', 'Analytics'];
const industries = ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education', 'Real Estate', 'Consulting', 'Media', 'Energy'];
const lifecycleStages = ['lead', 'prospect', 'customer', 'partner'];
const opportunityStages = ['qualification', 'needs_analysis', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const titles = ['CEO', 'CTO', 'VP of Sales', 'VP of Marketing', 'Director of Operations', 'Product Manager', 'Engineering Manager', 'Sales Manager', 'Account Executive', 'Business Development Manager'];
const leadSources = ['website', 'referral', 'social', 'email', 'event', 'partner', 'cold_call'];
const activityTypes = ['call', 'meeting', 'email', 'demo'];
const taskPriorities = ['low', 'normal', 'high'];
const campaignTypes = ['email', 'webinar', 'conference', 'trade_show', 'ads', 'social', 'direct_mail', 'other'];
const orderStatuses = ['draft', 'activated', 'approved', 'completed', 'cancelled'];
const contractStatuses = ['draft', 'in_approval', 'activated', 'expired', 'terminated'];
const assetStatuses = ['purchased', 'shipped', 'installed', 'registered', 'active', 'obsolete'];
const caseStatuses = ['new', 'in_progress', 'escalated', 'on_hold', 'resolved', 'closed'];
const casePriorities = ['low', 'medium', 'high', 'critical'];
const caseOrigins = ['email', 'phone', 'web', 'chat'];
const articleTypes = ['faq', 'how-to', 'troubleshooting', 'reference', 'announcement'];
const knowledgeCategories = ['Getting Started', 'Billing', 'Technical', 'Product Features', 'Account Management'];

// Random selection helper
function random<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Random number helper
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random date helpers
function randomFutureDate(daysAhead: number = 90): string {
  const date = new Date();
  date.setDate(date.getDate() + randomInt(1, daysAhead));
  return date.toISOString().split('T')[0];
}

function randomPastDate(daysAgo: number = 30): string {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(1, daysAgo));
  return date.toISOString().split('T')[0];
}

// Generate random person
function generatePerson() {
  const firstName = random(firstNames);
  const lastName = random(lastNames);
  return {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${random(['gmail', 'yahoo', 'outlook', 'company'])}.com`,
    phone: `555-${randomInt(1000, 9999)}`
  };
}

// Generate random company
function generateCompany() {
  const name = `${random(companyNames)} ${random(companySuffixes)}`;
  return {
    name,
    website: `https://${name.toLowerCase().replace(/\s+/g, '')}.com`,
    industry: random(industries)
  };
}

// API helper
async function createEvent(type: string, entity_type: string, entity_id: string, data: any) {
  try {
    const response = await fetch(`${API_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, entity_type, entity_id, data })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`   ❌ Failed to create ${entity_type}:`, result.errors || result.error);
      return null;
    }

    console.log(`   ✅ Event created: ${data.name}`);
    return result;
  } catch (error: any) {
    console.error(`   ❌ Error creating ${entity_type}:`, error.message);
    return null;
  }
}

// Process events - runs the process-events script
function processEvents(): boolean {
  console.log(`   🔄 Processing event to markdown...`);
  const result = spawnSync('npx', ['tsx', 'scripts/process-events.ts'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    console.error(`   ❌ Failed to process events:`, result.stderr);
    return false;
  }

  return true;
}

// Sync files - runs the sync-files script
function syncFiles(): boolean {
  console.log(`   📊 Syncing to database...`);
  const result = spawnSync('npx', ['tsx', 'scripts/sync-all-files.ts'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    console.error(`   ❌ Failed to sync files:`, result.stderr);
    return false;
  }

  return true;
}

// Reset data
function resetData(): boolean {
  console.log('🧹 Resetting data...\n');
  const result = spawnSync('npx', ['tsx', 'scripts/reset-data.ts'], {
    cwd: process.cwd(),
    stdio: 'inherit'
  });

  return result.status === 0;
}

// Create and process a single record
async function createAndProcessRecord(
  entityType: string,
  emoji: string,
  dataGenerator: () => any,
  index: number,
  total: number
): Promise<boolean> {
  console.log(`\n${emoji} Creating ${entityType} ${index + 1}/${total}:`);

  const data = dataGenerator();
  const event = await createEvent('create', entityType, data.id, data);

  if (!event) {
    return false;
  }

  if (!processEvents()) {
    return false;
  }

  if (!syncFiles()) {
    return false;
  }

  console.log(`   ✨ Complete! (${entityType}: ${data.name})`);
  await sleep(DELAY_MS);

  return true;
}

// Entity generators
function generateAccountData() {
  const id = generateId('acc');
  const company = generateCompany();
  return {
    id,
    name: company.name,
    website: company.website,
    industry: company.industry,
    lifecycle_stage: random(lifecycleStages),
    type: 'Account'
  };
}

function generateContactData() {
  const id = generateId('con');
  const person = generatePerson();
  return {
    id,
    name: person.name,
    first_name: person.firstName,
    last_name: person.lastName,
    email: person.email,
    phone: person.phone,
    title: random(titles),
    type: 'Contact'
  };
}

function generateOpportunityData() {
  const id = generateId('opp');
  const company = generateCompany();
  return {
    id,
    name: `${company.name} - Q${randomInt(1, 4)} Deal`,
    stage: random(opportunityStages),
    amount_acv: randomInt(10, 500) * 1000,
    close_date: randomFutureDate(90),
    probability: randomInt(1, 10) / 10,
    type: 'Opportunity'
  };
}

function generateLeadData() {
  const id = generateId('led');
  const person = generatePerson();
  return {
    id,
    name: person.name,
    status: random(['new', 'contacted', 'qualified', 'unqualified']),
    source: random(leadSources),
    email: person.email,
    phone: person.phone,
    type: 'Lead'
  };
}

function generateActivityData() {
  const id = generateId('act');
  const kind = random(activityTypes);
  const activityNames = {
    call: ['Discovery Call', 'Follow-up Call', 'Demo Call', 'Closing Call'],
    meeting: ['Initial Meeting', 'Product Demo', 'Strategy Session', 'Executive Meeting'],
    email: ['Introduction Email', 'Follow-up Email', 'Proposal Email', 'Check-in Email'],
    demo: ['Product Demo', 'Feature Walkthrough', 'Technical Demo', 'POC Demo']
  };
  return {
    id,
    name: random(activityNames[kind]),
    kind: kind,
    when: randomFutureDate(30),
    status: random(['scheduled', 'completed', 'cancelled']),
    type: 'Activity'
  };
}

function generateTaskData() {
  const id = generateId('tsk');
  const taskSubjects = [
    'Follow up with prospect',
    'Send proposal',
    'Schedule demo',
    'Review contract',
    'Prepare presentation',
    'Update CRM records',
    'Research competitor',
    'Call customer',
    'Send thank you note',
    'Update pipeline'
  ];
  const subject = random(taskSubjects);
  return {
    id,
    name: subject,
    subject: subject,
    status: random(['not_started', 'in_progress', 'completed', 'deferred']),
    priority: random(taskPriorities),
    due_date: randomFutureDate(30),
    type: 'Task'
  };
}

function generateQuoteData(index: number) {
  const id = generateId('quo');
  return {
    id,
    name: `Quote #${1000 + index}`,
    status: random(['draft', 'sent', 'accepted', 'rejected', 'expired']),
    total_amount: randomInt(10, 200) * 1000,
    valid_until: randomFutureDate(30),
    type: 'Quote'
  };
}

function generateProductData() {
  const id = generateId('prd');
  const productPrefixes = ['Enterprise', 'Professional', 'Standard', 'Premium', 'Basic'];
  const productTypes = ['Platform', 'Suite', 'Solution', 'Package', 'Bundle', 'Service'];
  return {
    id,
    name: `${random(productPrefixes)} ${random(productTypes)}`,
    sku: `PRD-${randomInt(1000, 9999)}`,
    price: randomInt(10, 500) * 100,
    status: random(['active', 'inactive', 'archived']),
    type: 'Product'
  };
}

function generateCampaignData(index: number) {
  const id = generateId('cmp');
  const campaignNames = [
    'Q1 Launch Campaign',
    'Summer Promotion',
    'Product Webinar Series',
    'Email Newsletter',
    'Social Media Blitz',
    'Trade Show Event',
    'Content Marketing Push',
    'Partner Co-Marketing',
    'Holiday Special',
    'Year-End Campaign'
  ];
  return {
    id,
    name: campaignNames[index % campaignNames.length] + ` ${new Date().getFullYear()}`,
    campaign_type: random(campaignTypes),
    status: random(['planned', 'active', 'completed', 'aborted']),
    start_date: randomPastDate(30),
    end_date: randomFutureDate(60),
    budget: randomInt(5, 100) * 1000,
    type: 'Campaign'
  };
}

function generateEventData() {
  const id = generateId('evt');
  const eventSubjects = [
    'Quarterly Business Review',
    'Product Roadmap Discussion',
    'Contract Renewal Meeting',
    'Executive Alignment Session',
    'Training Workshop',
    'Account Planning Meeting',
    'Technical Deep Dive',
    'Success Planning Call'
  ];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + randomInt(1, 60));
  const endDate = new Date(startDate.getTime() + (randomInt(30, 120) * 60000));

  return {
    id,
    subject: random(eventSubjects),
    start_datetime: startDate.toISOString(),
    end_datetime: endDate.toISOString(),
    location: random(['Zoom', 'Google Meet', 'Conference Room A', 'Customer Site', 'Teams']),
    type: 'Event',
    name: random(eventSubjects)
  };
}

function generateOrderData(index: number) {
  const id = generateId('ord');
  const name = `Order #ORD-${new Date().getFullYear()}-${String(index + 1).padStart(3, '0')}`;
  return {
    id,
    name,
    status: random(orderStatuses),
    effective_date: randomPastDate(60),
    total_amount: randomInt(20, 500) * 1000,
    order_number: `ORD-${new Date().getFullYear()}-${String(index + 1).padStart(3, '0')}`,
    type: 'Order'
  };
}

function generateContractData(index: number) {
  const id = generateId('ctr');
  const startDate = randomPastDate(180);
  const termMonths = random([12, 24, 36]);
  const start = new Date(startDate);
  start.setMonth(start.getMonth() + termMonths);
  const name = `Contract #CTR-${new Date().getFullYear()}-${String(index + 1).padStart(3, '0')}`;

  return {
    id,
    name,
    status: random(contractStatuses),
    start_date: startDate,
    end_date: start.toISOString().split('T')[0],
    contract_term: termMonths,
    total_value: randomInt(50, 1000) * 1000,
    contract_number: `CTR-${new Date().getFullYear()}-${String(index + 1).padStart(3, '0')}`,
    type: 'Contract'
  };
}

function generateAssetData(index: number) {
  const id = generateId('ast');
  const productNames = ['Enterprise Platform License', 'Professional Suite', 'Premium Bundle', 'Standard Package'];
  const name = `${random(productNames)} - ${String(index + 1).padStart(3, '0')}`;

  return {
    id,
    name,
    status: random(assetStatuses),
    purchase_date: randomPastDate(365),
    install_date: randomPastDate(300),
    quantity: randomInt(1, 100),
    serial_number: `SN-${randomInt(10000, 99999)}`,
    type: 'Asset'
  };
}

function generateCaseData(index: number) {
  const id = generateId('cas');
  const caseSubjects = [
    'Login Issues',
    'Performance Problem',
    'Feature Request',
    'Data Export Issue',
    'Integration Question',
    'Billing Inquiry',
    'Account Access',
    'Bug Report'
  ];
  const subject = `${random(caseSubjects)} - CASE-${String(index + 1).padStart(4, '0')}`;

  return {
    id,
    name: subject,
    subject,
    status: random(caseStatuses),
    priority: random(casePriorities),
    origin: random(caseOrigins),
    case_number: `CASE-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}`,
    type: 'Case'
  };
}

function generateKnowledgeData(index: number) {
  const id = generateId('kav');
  const articleTitles = [
    'How to Reset Your Password',
    'Getting Started Guide',
    'Troubleshooting Login Issues',
    'API Integration Best Practices',
    'Setting Up Two-Factor Authentication',
    'Understanding Billing Cycles',
    'Data Export Guide',
    'Account Management FAQ',
    'System Requirements',
    'Mobile App Installation'
  ];
  const title = articleTitles[index % articleTitles.length];

  return {
    id,
    name: title,
    title,
    article_type: random(articleTypes),
    category: random(knowledgeCategories),
    is_published: random([true, true, true, false]),
    article_number: `KB-${String(index + 1).padStart(4, '0')}`,
    type: 'Knowledge'
  };
}

// Main
async function main() {
  console.log('🐌 Starting SLOW reseed with real-time processing...\n');
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`⏱️  Delay: ${DELAY_MS}ms between records`);
  console.log(`🔄 Each record: Event → Markdown → Database\n`);

  const recordsPerType = parseInt(process.argv[2] || '10');
  console.log(`📊 Creating ${recordsPerType} records per entity type\n`);

  const totalRecords = recordsPerType * 15; // Updated to 15 entity types
  const estimatedMinutes = Math.ceil((totalRecords * (DELAY_MS + 2000)) / 60000); // +2s for processing
  console.log(`⏰ Estimated time: ~${estimatedMinutes} minutes for ${totalRecords} records\n`);

  // Reset data first
  if (!resetData()) {
    console.error('\n❌ Reset failed! Aborting.');
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Starting incremental seeding...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Accounts
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Account', '🏢', generateAccountData, i, recordsPerType);
    }

    // Contacts
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Contact', '👤', generateContactData, i, recordsPerType);
    }

    // Opportunities
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Opportunity', '💰', generateOpportunityData, i, recordsPerType);
    }

    // Leads
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Lead', '🎯', generateLeadData, i, recordsPerType);
    }

    // Activities
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Activity', '📅', generateActivityData, i, recordsPerType);
    }

    // Tasks
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Task', '✓', generateTaskData, i, recordsPerType);
    }

    // Quotes
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Quote', '📄', () => generateQuoteData(i), i, recordsPerType);
    }

    // Products
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Product', '📦', generateProductData, i, recordsPerType);
    }

    // Campaigns
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Campaign', '📢', () => generateCampaignData(i), i, recordsPerType);
    }

    // Events
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Event', '📅', generateEventData, i, recordsPerType);
    }

    // Orders
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Order', '📋', () => generateOrderData(i), i, recordsPerType);
    }

    // Contracts
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Contract', '📜', () => generateContractData(i), i, recordsPerType);
    }

    // Assets
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Asset', '🔧', () => generateAssetData(i), i, recordsPerType);
    }

    // Cases
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Case', '🎫', () => generateCaseData(i), i, recordsPerType);
    }

    // Knowledge
    for (let i = 0; i < recordsPerType; i++) {
      await createAndProcessRecord('Knowledge', '📚', () => generateKnowledgeData(i), i, recordsPerType);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Slow reseed complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Check your UIs:');
    console.log('   - Slack app: http://localhost:5173/');
    console.log('   - Quip app: http://localhost:5174/');
    console.log('   - SF app: http://localhost:5175/');
  } catch (error: any) {
    console.error('\n❌ Reseed failed:', error.message);
    process.exit(1);
  }
}

main();
