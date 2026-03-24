import { Kind, generateId, getDirName } from './entities.js';
import { writeMarkdown, getEntityDir, slugify } from './vault.js';

/**
 * Seeding options
 */
export interface SeedOptions {
  count?: number;
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Random data generators
 */
const FIRST_NAMES = [
  'Alice',
  'Bob',
  'Charlie',
  'Diana',
  'Eve',
  'Frank',
  'Grace',
  'Henry',
  'Ivy',
  'Jack',
];
const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
];
const COMPANIES = [
  'Acme Corp',
  'Globex Inc',
  'Initech',
  'Umbrella Corp',
  'Stark Industries',
  'Wayne Enterprises',
  'Oscorp',
  'LexCorp',
  'Tyrell Corp',
  'Weyland-Yutani',
];
const DOMAINS = [
  'example.com',
  'test.com',
  'demo.com',
  'sample.com',
  'placeholder.com',
];

/**
 * Random number between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random item from array
 */
function randomItem<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

/**
 * Random date between start and end
 */
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Generate random email
 */
function randomEmail(): string {
  const firstName = randomItem(FIRST_NAMES).toLowerCase();
  const lastName = randomItem(LAST_NAMES).toLowerCase();
  const domain = randomItem(DOMAINS);
  return `${firstName}.${lastName}@${domain}`;
}

/**
 * Generate random phone
 */
function randomPhone(): string {
  return `+1-555-${randomInt(100, 999)}-${randomInt(1000, 9999)}`;
}

/**
 * Generate random company name
 */
function randomCompany(): string {
  return randomItem(COMPANIES);
}

/**
 * Generate random person name
 */
function randomName(): string {
  return `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
}

/**
 * Generate random amount
 */
function randomAmount(min: number = 1000, max: number = 100000): number {
  return randomInt(min, max);
}

/**
 * Generate demo account
 */
export function generateAccount(index?: number): {
  name: string;
  frontmatter: any;
  body: string;
} {
  const name = index ? `${randomCompany()} ${index}` : randomCompany();
  const id = generateId('account');

  return {
    name,
    frontmatter: {
      id,
      type: 'Account',
      name,
      lifecycle_stage: randomItem(['prospect', 'customer', 'churned']),
      created: new Date().toISOString().slice(0, 10),
    },
    body: `# ${name}\n\n## Overview\n- \n`,
  };
}

/**
 * Generate demo contact
 */
export function generateContact(
  accountSlug?: string,
  index?: number,
): {
  name: string;
  frontmatter: any;
  body: string;
} {
  const firstName = randomItem(FIRST_NAMES);
  const lastName = randomItem(LAST_NAMES);
  const name = `${firstName} ${lastName}`;
  const id = generateId('contact');

  return {
    name,
    frontmatter: {
      id,
      type: 'Contact',
      name,
      first_name: firstName,
      last_name: lastName,
      email: randomEmail(),
      phone: randomPhone(),
      account: accountSlug ? `[[accounts/${accountSlug}]]` : null,
    },
    body: `# ${name}\n\n## Notes\n- \n`,
  };
}

/**
 * Generate demo opportunity
 */
export function generateOpportunity(
  accountSlug?: string,
  index?: number,
): {
  name: string;
  frontmatter: any;
  body: string;
} {
  const name = index
    ? `Deal ${index} - ${randomCompany()}`
    : `Deal - ${randomCompany()}`;
  const id = generateId('opportunity');

  return {
    name,
    frontmatter: {
      id,
      type: 'Opportunity',
      name,
      account: accountSlug ? `[[accounts/${accountSlug}]]` : null,
      stage: randomItem(['discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
      amount_acv: randomAmount(10000, 500000),
      close_date: randomDate(new Date(), new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))
        .toISOString()
        .slice(0, 10),
      probability: Math.random(),
      next_action: 'Follow up',
    },
    body: `# ${name}\n\n- Key risks:\n  - TBD\n`,
  };
}

/**
 * Generate demo lead
 */
export function generateLead(index?: number): {
  name: string;
  frontmatter: any;
  body: string;
} {
  const name = randomName();
  const id = generateId('lead');

  return {
    name,
    frontmatter: {
      id,
      type: 'Lead',
      name,
      email: randomEmail(),
      phone: randomPhone(),
      company: randomCompany(),
      status: randomItem(['new', 'contacted', 'qualified', 'unqualified']),
      rating: randomItem(['hot', 'warm', 'cold']),
    },
    body: `# ${name}\n\n## Qualification Notes\n- \n`,
  };
}

/**
 * Generate demo product
 */
export function generateProduct(index?: number): {
  name: string;
  frontmatter: any;
  body: string;
} {
  const products = [
    'Enterprise License',
    'Professional Plan',
    'Starter Pack',
    'Premium Support',
    'Training Package',
  ];
  const name = index ? `${randomItem(products)} ${index}` : randomItem(products);
  const id = generateId('product');

  return {
    name,
    frontmatter: {
      id,
      type: 'Product',
      name,
      price: randomAmount(100, 10000),
      is_active: true,
    },
    body: `# ${name}\n\n## Description\n- \n\n## Features\n- \n`,
  };
}

/**
 * Seed entities of a specific kind
 */
export function seedEntities(
  kind: Kind,
  options: SeedOptions = {},
): Array<{ name: string; slug: string; path: string }> {
  const count = options.count || 10;
  const results: Array<{ name: string; slug: string; path: string }> = [];

  for (let i = 0; i < count; i++) {
    let data: { name: string; frontmatter: any; body: string };

    switch (kind) {
      case 'account':
        data = generateAccount(i + 1);
        break;
      case 'contact':
        data = generateContact(undefined, i + 1);
        break;
      case 'opportunity':
        data = generateOpportunity(undefined, i + 1);
        break;
      case 'lead':
        data = generateLead(i + 1);
        break;
      case 'product':
        data = generateProduct(i + 1);
        break;
      default:
        // Skip unsupported kinds for now
        continue;
    }

    const slug = slugify(data.name);
    const dir = getEntityDir(getDirName(kind));

    if (!options.dryRun) {
      const filePath = writeMarkdown(dir, `${slug}.md`, data.frontmatter, data.body);
      results.push({ name: data.name, slug, path: filePath });

      if (options.verbose) {
        console.log(`Created ${kind}: ${data.name}`);
      }
    } else {
      results.push({ name: data.name, slug, path: `${dir}/${slug}.md` });
    }
  }

  return results;
}
