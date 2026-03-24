#!/usr/bin/env node
/**
 * Data seeder for Zax CRM
 * Generates random test data for all entity types
 */

import { ulid } from 'ulidx';

const API_URL = 'http://localhost:9600';

// ID generators for each entity type
function generateId(prefix: string): string {
  return `${prefix}_${ulid().toLowerCase()}`;
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

// Seed functions
async function seedAccounts(count: number = 10) {
  console.log(`\n🏢 Seeding ${count} accounts...`);

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
  }
}

async function seedContacts(count: number = 10) {
  console.log(`\n👤 Seeding ${count} contacts...`);

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
  }
}

async function seedOpportunities(count: number = 10) {
  console.log(`\n💰 Seeding ${count} opportunities...`);

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
  }
}

async function seedLeads(count: number = 10) {
  console.log(`\n🎯 Seeding ${count} leads...`);

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
  }
}

async function seedActivities(count: number = 10) {
  console.log(`\n📅 Seeding ${count} activities...`);

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
  }
}

async function seedTasks(count: number = 10) {
  console.log(`\n✓ Seeding ${count} tasks...`);

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
  }
}

async function seedQuotes(count: number = 10) {
  console.log(`\n📄 Seeding ${count} quotes...`);

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
  }
}

async function seedProducts(count: number = 10) {
  console.log(`\n📦 Seeding ${count} products...`);

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
  }
}

async function seedCampaigns(count: number = 10) {
  console.log(`\n📢 Seeding ${count} campaigns...`);

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
  }
}

async function seedEvents(count: number = 10) {
  console.log(`\n📅 Seeding ${count} events...`);

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

  for (let i = 0; i < count; i++) {
    const id = generateId('evt');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + randomInt(1, 60));
    const endDate = new Date(startDate.getTime() + (randomInt(30, 120) * 60000)); // 30-120 min
    const subject = random(eventSubjects);

    await createEvent('create', 'Event', id, {
      id,
      name: subject,
      subject: subject,
      start_datetime: startDate.toISOString(),
      end_datetime: endDate.toISOString(),
      location: random(['Zoom', 'Google Meet', 'Conference Room A', 'Customer Site', 'Teams']),
      type: 'Event'
    });
  }
}

async function seedOrders(count: number = 10) {
  console.log(`\n📋 Seeding ${count} orders...`);

  for (let i = 0; i < count; i++) {
    const id = generateId('ord');
    const company = generateCompany();
    await createEvent('create', 'Order', id, {
      id,
      name: `Order #ORD-${new Date().getFullYear()}-${String(i + 1).padStart(3, '0')}`,
      account: `[[accounts/${company.name.toLowerCase().replace(/\s+/g, '-')}]]`,
      status: random(orderStatuses),
      effective_date: randomPastDate(60),
      total_amount: randomInt(20, 500) * 1000,
      order_number: `ORD-${new Date().getFullYear()}-${String(i + 1).padStart(3, '0')}`,
      type: 'Order'
    });
  }
}

async function seedContracts(count: number = 10) {
  console.log(`\n📜 Seeding ${count} contracts...`);

  for (let i = 0; i < count; i++) {
    const id = generateId('ctr');
    const company = generateCompany();
    const startDate = randomPastDate(180);
    const termMonths = random([12, 24, 36]);
    const start = new Date(startDate);
    start.setMonth(start.getMonth() + termMonths);

    await createEvent('create', 'Contract', id, {
      id,
      name: `Contract #CTR-${new Date().getFullYear()}-${String(i + 1).padStart(3, '0')}`,
      account: `[[accounts/${company.name.toLowerCase().replace(/\s+/g, '-')}]]`,
      status: random(contractStatuses),
      start_date: startDate,
      end_date: start.toISOString().split('T')[0],
      contract_term: termMonths,
      total_value: randomInt(50, 1000) * 1000,
      contract_number: `CTR-${new Date().getFullYear()}-${String(i + 1).padStart(3, '0')}`,
      type: 'Contract'
    });
  }
}

async function seedAssets(count: number = 10) {
  console.log(`\n🔧 Seeding ${count} assets...`);

  const productPrefixes = ['Enterprise', 'Professional', 'Premium', 'Standard'];
  const productTypes = ['Platform', 'Suite', 'Bundle', 'Package'];

  for (let i = 0; i < count; i++) {
    const id = generateId('ast');
    const company = generateCompany();
    const productName = `${random(productPrefixes)} ${random(productTypes)}`;

    await createEvent('create', 'Asset', id, {
      id,
      name: `${productName} - ${String(i + 1).padStart(3, '0')}`,
      account: `[[accounts/${company.name.toLowerCase().replace(/\s+/g, '-')}]]`,
      product: `[[products/${productName.toLowerCase().replace(/\s+/g, '-')}]]`,
      status: random(assetStatuses),
      purchase_date: randomPastDate(365),
      install_date: randomPastDate(300),
      quantity: randomInt(1, 100),
      serial_number: `SN-${randomInt(10000, 99999)}`,
      type: 'Asset'
    });
  }
}

async function seedCases(count: number = 10) {
  console.log(`\n🎫 Seeding ${count} cases...`);

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

  for (let i = 0; i < count; i++) {
    const id = generateId('cas');
    const subject = `${random(caseSubjects)} - CASE-${String(i + 1).padStart(4, '0')}`;
    await createEvent('create', 'Case', id, {
      id,
      name: subject,
      subject: subject,
      status: random(caseStatuses),
      priority: random(casePriorities),
      origin: random(caseOrigins),
      case_number: `CASE-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
      type: 'Case'
    });
  }
}

async function seedKnowledge(count: number = 10) {
  console.log(`\n📚 Seeding ${count} knowledge articles...`);

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

  for (let i = 0; i < count; i++) {
    const id = generateId('kav');
    const title = articleTitles[i % articleTitles.length];
    await createEvent('create', 'Knowledge', id, {
      id,
      name: title,
      title: title,
      article_type: random(articleTypes),
      category: random(knowledgeCategories),
      is_published: random([true, true, true, false]), // 75% published
      article_number: `KB-${String(i + 1).padStart(4, '0')}`,
      type: 'Knowledge'
    });
  }
}

// Main seeder
async function main() {
  console.log('🌱 Starting Zax CRM data seeder...\n');
  console.log(`📍 API URL: ${API_URL}\n`);

  const recordsPerType = parseInt(process.argv[2] || '10');
  console.log(`📊 Creating ${recordsPerType} records per entity type\n`);

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
    await seedEvents(recordsPerType);
    await seedOrders(recordsPerType);
    await seedContracts(recordsPerType);
    await seedAssets(recordsPerType);
    await seedCases(recordsPerType);
    await seedKnowledge(recordsPerType);

    console.log('\n✨ Seeding complete! Check your Slack app at http://localhost:5173/');
  } catch (error: any) {
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

main();
