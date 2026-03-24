#!/usr/bin/env node
/**
 * Slow Data Seeder for Zax CRM
 * Generates random test data with 1-second pauses between each record
 * Useful for watching the data flow through the system in real-time
 */

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

// Random selection helper
function random<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Random number helper
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random date helper (future)
function randomFutureDate(daysAhead: number = 90): string {
  const date = new Date();
  date.setDate(date.getDate() + randomInt(1, daysAhead));
  return date.toISOString().split('T')[0];
}

// Random date helper (past)
function randomPastDate(daysAgo: number = 30): string {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(1, daysAgo));
  return date.toISOString().split('T')[0];
}

// Generate random person name
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
      console.error(`❌ Failed to create ${entity_type}:`, result.errors || result.error);
      return null;
    }

    console.log(`✅ Created ${entity_type}: ${data.name} (${result.event_id})`);
    return result;
  } catch (error: any) {
    console.error(`❌ Error creating ${entity_type}:`, error.message);
    return null;
  }
}

// Seed functions with delays
async function seedAccounts(count: number = 10) {
  console.log(`\n🏢 Seeding ${count} accounts (1 per second)...`);

  for (let i = 0; i < count; i++) {
    const id = generateId('acc');
    const company = generateCompany();
    await createEvent('create', 'Account', id, {
      id,
      name: company.name,
      website: company.website,
      industry: company.industry,
      lifecycle_stage: random(lifecycleStages),
      type: 'Account'
    });
    await sleep(DELAY_MS);
  }
}

async function seedContacts(count: number = 10) {
  console.log(`\n👤 Seeding ${count} contacts (1 per second)...`);

  for (let i = 0; i < count; i++) {
    const id = generateId('con');
    const person = generatePerson();
    await createEvent('create', 'Contact', id, {
      id,
      name: person.name,
      first_name: person.firstName,
      last_name: person.lastName,
      email: person.email,
      phone: person.phone,
      title: random(titles),
      type: 'Contact'
    });
    await sleep(DELAY_MS);
  }
}

async function seedOpportunities(count: number = 10) {
  console.log(`\n💰 Seeding ${count} opportunities (1 per second)...`);

  for (let i = 0; i < count; i++) {
    const id = generateId('opp');
    const company = generateCompany();
    await createEvent('create', 'Opportunity', id, {
      id,
      name: `${company.name} - Q${randomInt(1, 4)} Deal`,
      stage: random(opportunityStages),
      amount_acv: randomInt(10, 500) * 1000,
      close_date: randomFutureDate(90),
      probability: randomInt(1, 10) / 10,
      type: 'Opportunity'
    });
    await sleep(DELAY_MS);
  }
}

async function seedLeads(count: number = 10) {
  console.log(`\n🎯 Seeding ${count} leads (1 per second)...`);

  for (let i = 0; i < count; i++) {
    const id = generateId('led');
    const person = generatePerson();
    await createEvent('create', 'Lead', id, {
      id,
      name: person.name,
      status: random(['new', 'contacted', 'qualified', 'unqualified']),
      source: random(leadSources),
      email: person.email,
      phone: person.phone,
      type: 'Lead'
    });
    await sleep(DELAY_MS);
  }
}

async function seedActivities(count: number = 10) {
  console.log(`\n📅 Seeding ${count} activities (1 per second)...`);

  const activityNames = {
    call: ['Discovery Call', 'Follow-up Call', 'Demo Call', 'Closing Call'],
    meeting: ['Initial Meeting', 'Product Demo', 'Strategy Session', 'Executive Meeting'],
    email: ['Introduction Email', 'Follow-up Email', 'Proposal Email', 'Check-in Email'],
    demo: ['Product Demo', 'Feature Walkthrough', 'Technical Demo', 'POC Demo']
  };

  for (let i = 0; i < count; i++) {
    const id = generateId('act');
    const kind = random(activityTypes);
    await createEvent('create', 'Activity', id, {
      id,
      name: random(activityNames[kind]),
      kind: kind,
      when: randomFutureDate(30),
      status: random(['scheduled', 'completed', 'cancelled']),
      type: 'Activity'
    });
    await sleep(DELAY_MS);
  }
}

async function seedTasks(count: number = 10) {
  console.log(`\n✓ Seeding ${count} tasks (1 per second)...`);

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

  for (let i = 0; i < count; i++) {
    const id = generateId('tsk');
    await createEvent('create', 'Task', id, {
      id,
      name: random(taskSubjects),
      subject: random(taskSubjects),
      status: random(['not_started', 'in_progress', 'completed', 'deferred']),
      priority: random(taskPriorities),
      due_date: randomFutureDate(30),
      type: 'Task'
    });
    await sleep(DELAY_MS);
  }
}

async function seedQuotes(count: number = 10) {
  console.log(`\n📄 Seeding ${count} quotes (1 per second)...`);

  for (let i = 0; i < count; i++) {
    const id = generateId('quo');
    await createEvent('create', 'Quote', id, {
      id,
      name: `Quote #${1000 + i}`,
      status: random(['draft', 'sent', 'accepted', 'rejected', 'expired']),
      total_amount: randomInt(10, 200) * 1000,
      valid_until: randomFutureDate(30),
      type: 'Quote'
    });
    await sleep(DELAY_MS);
  }
}

async function seedProducts(count: number = 10) {
  console.log(`\n📦 Seeding ${count} products (1 per second)...`);

  const productPrefixes = ['Enterprise', 'Professional', 'Standard', 'Premium', 'Basic'];
  const productTypes = ['Platform', 'Suite', 'Solution', 'Package', 'Bundle', 'Service'];

  for (let i = 0; i < count; i++) {
    const id = generateId('prd');
    await createEvent('create', 'Product', id, {
      id,
      name: `${random(productPrefixes)} ${random(productTypes)}`,
      sku: `PRD-${randomInt(1000, 9999)}`,
      price: randomInt(10, 500) * 100,
      status: random(['active', 'inactive', 'archived']),
      type: 'Product'
    });
    await sleep(DELAY_MS);
  }
}

async function seedCampaigns(count: number = 10) {
  console.log(`\n📢 Seeding ${count} campaigns (1 per second)...`);

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

  for (let i = 0; i < count; i++) {
    const id = generateId('cmp');
    await createEvent('create', 'Campaign', id, {
      id,
      name: campaignNames[i % campaignNames.length] + ` ${new Date().getFullYear()}`,
      campaign_type: random(campaignTypes),
      status: random(['planned', 'active', 'completed', 'aborted']),
      start_date: randomPastDate(30),
      end_date: randomFutureDate(60),
      budget: randomInt(5, 100) * 1000,
      type: 'Campaign'
    });
    await sleep(DELAY_MS);
  }
}

// Main seeder
async function main() {
  console.log('🐌 Starting SLOW Zax CRM data seeder...\n');
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`⏱️  Delay: ${DELAY_MS}ms between records\n`);

  const recordsPerType = parseInt(process.argv[2] || '10');
  console.log(`📊 Creating ${recordsPerType} records per entity type\n`);

  const totalRecords = recordsPerType * 9;
  const estimatedMinutes = Math.ceil((totalRecords * DELAY_MS) / 60000);
  console.log(`⏰ Estimated time: ~${estimatedMinutes} minutes for ${totalRecords} records\n`);

  try {
    await seedAccounts(recordsPerType);
    await seedContacts(recordsPerType);
    await seedOpportunities(recordsPerType);
    await seedLeads(recordsPerType);
    await seedActivities(recordsPerType);
    await seedTasks(recordsPerType);
    await seedQuotes(recordsPerType);
    await seedProducts(recordsPerType);
    await seedCampaigns(recordsPerType);

    console.log('\n✨ Slow seeding complete! Check your UIs:');
    console.log('   - Slack app: http://localhost:5173/');
    console.log('   - Quip app: http://localhost:5174/');
    console.log('   - SF app: http://localhost:5175/');
  } catch (error: any) {
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

main();
