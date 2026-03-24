import Database from 'better-sqlite3';
import { ulid } from 'ulidx';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'vault/crm.db');
const db = new Database(DB_PATH);

// Seed party data
const parties = [
  {
    id: 'pty_01JTEST001',
    type: 'party',
    name: 'Jane Doe',
    party_type: 'Individual',
    canonical_name: 'jane-doe',
    unified_score: 0.95,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pty_01JTEST002',
    type: 'party',
    name: 'John Smith',
    party_type: 'Individual',
    canonical_name: 'john-smith',
    unified_score: 0.88,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pty_01JTEST003',
    type: 'party',
    name: 'Acme Corporation',
    party_type: 'Organization',
    canonical_name: 'acme-corporation',
    unified_score: 0.92,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Seed contact point emails
const emails = [
  {
    id: 'cpe_01JTEST001',
    type: 'contact_point_email',
    name: 'Jane Work Email',
    party_id: 'pty_01JTEST001',
    email_address: 'jane.doe@example.com',
    email_type: 'Work',
    is_primary: 1,
    is_verified: 1,
    opt_in_status: 'Opted In',
    bounce_status: 'Valid',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cpe_01JTEST002',
    type: 'contact_point_email',
    name: 'Jane Personal Email',
    party_id: 'pty_01JTEST001',
    email_address: 'jane@personal.com',
    email_type: 'Personal',
    is_primary: 0,
    is_verified: 1,
    opt_in_status: 'Opted In',
    bounce_status: 'Valid',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cpe_01JTEST003',
    type: 'contact_point_email',
    name: 'John Work Email',
    party_id: 'pty_01JTEST002',
    email_address: 'john.smith@company.com',
    email_type: 'Work',
    is_primary: 1,
    is_verified: 1,
    opt_in_status: 'Opted In',
    bounce_status: 'Valid',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Seed contact point phones
const phones = [
  {
    id: 'cpp_01JTEST001',
    type: 'contact_point_phone',
    name: 'Jane Mobile',
    party_id: 'pty_01JTEST001',
    phone_number: '+1-555-123-4567',
    phone_type: 'Mobile',
    is_primary: 1,
    is_verified: 1,
    sms_opt_in: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cpp_01JTEST002',
    type: 'contact_point_phone',
    name: 'John Work Phone',
    party_id: 'pty_01JTEST002',
    phone_number: '+1-555-987-6543',
    phone_type: 'Work',
    is_primary: 1,
    is_verified: 1,
    sms_opt_in: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Seed contact point addresses
const addresses = [
  {
    id: 'cpa_01JTEST001',
    type: 'contact_point_address',
    name: 'Jane Home Address',
    party_id: 'pty_01JTEST001',
    address_type: 'Home',
    street_address: '123 Main Street',
    city: 'San Francisco',
    state_province: 'CA',
    postal_code: '94102',
    country: 'United States',
    is_primary: 1,
    is_verified: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cpa_01JTEST002',
    type: 'contact_point_address',
    name: 'John Office Address',
    party_id: 'pty_01JTEST002',
    address_type: 'Work',
    street_address: '456 Business Ave, Suite 200',
    city: 'New York',
    state_province: 'NY',
    postal_code: '10001',
    country: 'United States',
    is_primary: 1,
    is_verified: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

console.log('🌱 Seeding party data...');

try {
  // Insert parties
  const insertParty = db.prepare(`
    INSERT OR REPLACE INTO parties (id, type, name, party_type, canonical_name, unified_score, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const party of parties) {
    insertParty.run(
      party.id,
      party.type,
      party.name,
      party.party_type,
      party.canonical_name,
      party.unified_score,
      party.created_at,
      party.updated_at
    );
    console.log(`  ✓ Created party: ${party.name}`);
  }

  // Insert emails
  const insertEmail = db.prepare(`
    INSERT OR REPLACE INTO contact_point_emails
    (id, type, name, party_id, email_address, email_type, is_primary, is_verified, opt_in_status, bounce_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const email of emails) {
    insertEmail.run(
      email.id,
      email.type,
      email.name,
      email.party_id,
      email.email_address,
      email.email_type,
      email.is_primary,
      email.is_verified,
      email.opt_in_status,
      email.bounce_status,
      email.created_at,
      email.updated_at
    );
    console.log(`  ✓ Created email: ${email.email_address}`);
  }

  // Insert phones
  const insertPhone = db.prepare(`
    INSERT OR REPLACE INTO contact_point_phones
    (id, type, name, party_id, phone_number, phone_type, is_primary, is_verified, sms_opt_in, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const phone of phones) {
    insertPhone.run(
      phone.id,
      phone.type,
      phone.name,
      phone.party_id,
      phone.phone_number,
      phone.phone_type,
      phone.is_primary,
      phone.is_verified,
      phone.sms_opt_in,
      phone.created_at,
      phone.updated_at
    );
    console.log(`  ✓ Created phone: ${phone.phone_number}`);
  }

  // Insert addresses
  const insertAddress = db.prepare(`
    INSERT OR REPLACE INTO contact_point_addresses
    (id, type, name, party_id, address_type, street_address, city, state_province, postal_code, country, is_primary, is_verified, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const address of addresses) {
    insertAddress.run(
      address.id,
      address.type,
      address.name,
      address.party_id,
      address.address_type,
      address.street_address,
      address.city,
      address.state_province,
      address.postal_code,
      address.country,
      address.is_primary,
      address.is_verified,
      address.created_at,
      address.updated_at
    );
    console.log(`  ✓ Created address: ${address.street_address}, ${address.city}`);
  }

  console.log('✅ Seed complete!');
  console.log(`   - ${parties.length} parties`);
  console.log(`   - ${emails.length} emails`);
  console.log(`   - ${phones.length} phones`);
  console.log(`   - ${addresses.length} addresses`);
} catch (error) {
  console.error('❌ Seed failed:', error);
  process.exit(1);
} finally {
  db.close();
}
