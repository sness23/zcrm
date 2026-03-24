import { ulid } from 'ulidx';

/**
 * Entity kind type definition
 */
export type Kind =
  | 'account'
  | 'contact'
  | 'opportunity'
  | 'activity'
  | 'lead'
  | 'task'
  | 'quote'
  | 'product'
  | 'campaign'
  | 'line-item'
  | 'quote-line'
  | 'event'
  | 'order'
  | 'contract'
  | 'asset'
  | 'case'
  | 'knowledge';

/**
 * Mapping of entity kinds to directory names
 */
export const KIND_DIR: Record<Kind, string> = {
  account: 'accounts',
  contact: 'contacts',
  opportunity: 'opportunities',
  activity: 'activities',
  lead: 'leads',
  task: 'tasks',
  quote: 'quotes',
  product: 'products',
  campaign: 'campaigns',
  'line-item': 'line-items',
  'quote-line': 'quote-lines',
  event: 'events',
  order: 'orders',
  contract: 'contracts',
  asset: 'assets',
  case: 'cases',
  knowledge: 'knowledge',
};

/**
 * Mapping of entity kinds to ID prefixes
 */
export const KIND_PREFIX: Record<Kind, string> = {
  account: 'acc_',
  contact: 'con_',
  opportunity: 'opp_',
  activity: 'act_',
  lead: 'led_',
  task: 'tsk_',
  quote: 'quo_',
  product: 'prd_',
  campaign: 'cmp_',
  'line-item': 'oli_',
  'quote-line': 'qli_',
  event: 'evt_',
  order: 'ord_',
  contract: 'ctr_',
  asset: 'ast_',
  case: 'cas_',
  knowledge: 'kav_',
};

/**
 * Mapping of entity kinds to type names (capitalized)
 */
export const KIND_TYPE: Record<Kind, string> = {
  account: 'Account',
  contact: 'Contact',
  opportunity: 'Opportunity',
  activity: 'Activity',
  lead: 'Lead',
  task: 'Task',
  quote: 'Quote',
  product: 'Product',
  campaign: 'Campaign',
  'line-item': 'OpportunityLineItem',
  'quote-line': 'QuoteLineItem',
  event: 'Event',
  order: 'Order',
  contract: 'Contract',
  asset: 'Asset',
  case: 'Case',
  knowledge: 'Knowledge',
};

/**
 * Generate a ULID-based ID for an entity kind
 */
export function generateId(kind: Kind): string {
  const prefix = KIND_PREFIX[kind];
  return prefix + ulid().toLowerCase();
}

/**
 * Validate if a string is a valid entity kind
 */
export function isValidKind(kind: string): kind is Kind {
  return Object.keys(KIND_DIR).includes(kind as Kind);
}

/**
 * Get all entity kinds as an array
 */
export function getAllKinds(): Kind[] {
  return Object.keys(KIND_DIR) as Kind[];
}

/**
 * Get entity type name from kind
 */
export function getTypeName(kind: Kind): string {
  return KIND_TYPE[kind];
}

/**
 * Get directory name from kind
 */
export function getDirName(kind: Kind): string {
  return KIND_DIR[kind];
}

/**
 * Extract entity kind from an ID (based on prefix)
 */
export function getKindFromId(id: string): Kind | null {
  for (const [kind, prefix] of Object.entries(KIND_PREFIX)) {
    if (id.startsWith(prefix)) {
      return kind as Kind;
    }
  }
  return null;
}

/**
 * Common frontmatter fields for all entities
 */
export interface BaseFrontmatter {
  id: string;
  type: string;
  name?: string;
  subject?: string;
  title?: string;
}

/**
 * Create base frontmatter for an entity
 */
export function createBaseFrontmatter(kind: Kind, name: string): BaseFrontmatter {
  return {
    id: generateId(kind),
    type: getTypeName(kind),
    name,
  };
}
