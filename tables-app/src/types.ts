// Entity types matching the database schema

export interface Account {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  owner?: string;
  lifecycle_stage?: string;
  created?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Contact {
  id: string;
  account_id?: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Opportunity {
  id: string;
  account_id?: string;
  name: string;
  stage?: string;
  amount_acv?: number;
  close_date?: string;
  probability?: number;
  next_action?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: string;
  rating?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Activity {
  id: string;
  name: string;
  kind?: string;
  when_timestamp?: string;
  summary?: string;
  duration_min?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id: string;
  name: string;
  subject?: string;
  status?: string;
  priority?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Quote {
  id: string;
  opportunity_id?: string;
  account_id?: string;
  name: string;
  status?: string;
  amount?: number;
  valid_until?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  name: string;
  price?: number;
  is_active?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status?: string;
  campaign_type?: string;
  start_date?: string;
  budget?: number;
  num_leads?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Event {
  id: string;
  subject: string;
  start_datetime?: string;
  end_datetime?: string;
  location?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Order {
  id: string;
  account_id?: string;
  opportunity_id?: string;
  status?: string;
  effective_date?: string;
  total_amount?: number;
  order_number?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Contract {
  id: string;
  account_id?: string;
  opportunity_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  contract_term?: number;
  total_value?: number;
  contract_number?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Asset {
  id: string;
  account_id?: string;
  product_id?: string;
  status?: string;
  purchase_date?: string;
  install_date?: string;
  quantity?: number;
  serial_number?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Case {
  id: string;
  account_id?: string;
  contact_id?: string;
  subject: string;
  status?: string;
  priority?: string;
  case_number?: string;
  origin?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Knowledge {
  id: string;
  title: string;
  article_type?: string;
  category?: string;
  is_published?: boolean;
  summary?: string;
  article_number?: string;
  created_at?: string;
  updated_at?: string;
}

// Party Model entities
export interface Party {
  id: string;
  party_type?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Individual {
  id: string;
  party_id?: string;
  person_name?: string;
  person_given_name?: string;
  person_family_name?: string;
  person_middle_name?: string;
  birth_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Organization {
  id: string;
  party_id?: string;
  business_name?: string;
  legal_name?: string;
  tax_id?: string;
  website?: string;
  industry?: string;
  employee_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Household {
  id: string;
  party_id?: string;
  household_name?: string;
  household_type?: string;
  created_at?: string;
  updated_at?: string;
}

// Research Intelligence entities
export interface ResearcherProfile {
  id: string;
  party_id?: string;
  individual_id?: string;
  orcid_id?: string;
  current_institution?: string;
  current_position?: string;
  primary_research_area?: string;
  h_index?: number;
  total_citations?: number;
  publications_count?: number;
  first_author_papers?: number;
  last_author_papers?: number;
  recent_high_impact_papers?: number;
  total_funding_usd?: number;
  active_grants?: string[];
  funding_sources?: string[];
  lab_size?: number;
  tech_stack?: string[];
  lead_score?: number;
  lead_temperature?: string;
  last_enriched?: string;
  enrichment_sources?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface OrganizationProfile {
  id: string;
  party_id?: string;
  organization_id?: string;
  institution_type?: string;
  carnegie_classification?: string;
  is_r1_institution?: boolean;
  total_research_funding_usd?: number;
  nih_rank?: number;
  customer_count?: number;
  prospect_count?: number;
  total_revenue?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PartySource {
  id: string;
  party_id?: string;
  source_type?: string;
  source_name?: string;
  import_batch_id?: string;
  import_date?: string;
  enrichment_attempts?: number;
  last_enrichment_date?: string;
  enrichment_sources?: string[];
  enrichment_success_rate?: number;
  data_quality_score?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PartyEngagement {
  id: string;
  party_id?: string;
  lead_score?: number;
  lead_temperature?: string;
  pipeline_stage?: string;
  email_opens?: number;
  email_clicks?: number;
  webinar_attendances?: number;
  conference_interactions?: number;
  demo_requests?: number;
  created_at?: string;
  updated_at?: string;
}

export type Entity =
  | Account
  | Contact
  | Opportunity
  | Lead
  | Activity
  | Task
  | Quote
  | Product
  | Campaign
  | Event
  | Order
  | Contract
  | Asset
  | Case
  | Knowledge
  | Party
  | Individual
  | Organization
  | Household
  | ResearcherProfile
  | OrganizationProfile
  | PartySource
  | PartyEngagement;

export type EntityType =
  | 'accounts'
  | 'contacts'
  | 'opportunities'
  | 'leads'
  | 'activities'
  | 'tasks'
  | 'quotes'
  | 'products'
  | 'campaigns'
  | 'events'
  | 'orders'
  | 'contracts'
  | 'assets'
  | 'cases'
  | 'knowledge'
  | 'parties'
  | 'individuals'
  | 'organizations'
  | 'households'
  | 'researcher-profiles'
  | 'organization-profiles'
  | 'party-sources'
  | 'party-engagements';

export interface EntityConfig {
  type: EntityType;
  label: string;
  labelPlural: string;
  fields: {
    key: string;
    label: string;
    type: 'string' | 'number' | 'date' | 'currency' | 'percent';
  }[];
}

// App/Mode configuration (like Salesforce's app switcher)
// To add a new app/mode:
// 1. Add a new AppConfig object to APP_CONFIGS below
// 2. Specify which tabs (entity types) should appear in that app
// 3. The app will automatically appear in the app switcher dropdown
export interface AppConfig {
  id: string;
  name: string;
  icon?: string;
  tabs: EntityType[];
}

export const APP_CONFIGS: AppConfig[] = [
  {
    id: 'sales',
    name: 'Sales',
    icon: '💼',
    tabs: ['parties', 'leads', 'accounts', 'contacts', 'opportunities', 'quotes', 'products'],
  },
  {
    id: 'service',
    name: 'Service',
    icon: '🎧',
    tabs: ['cases', 'accounts', 'contacts', 'knowledge', 'assets'],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    icon: '📢',
    tabs: ['campaigns', 'leads', 'contacts', 'events'],
  },
  {
    id: 'operations',
    name: 'Operations',
    icon: '⚙️',
    tabs: ['orders', 'contracts', 'products', 'assets', 'accounts'],
  },
  {
    id: 'research',
    name: 'Research Intelligence',
    icon: '🔬',
    tabs: ['parties', 'individuals', 'researcher-profiles', 'organization-profiles', 'party-sources', 'party-engagements'],
  },
  {
    id: 'all',
    name: 'All Items',
    icon: '📋',
    tabs: [
      'parties',
      'individuals',
      'organizations',
      'households',
      'researcher-profiles',
      'organization-profiles',
      'party-sources',
      'party-engagements',
      'accounts',
      'contacts',
      'leads',
      'opportunities',
      'campaigns',
      'cases',
      'tasks',
      'activities',
      'events',
      'quotes',
      'products',
      'orders',
      'contracts',
      'assets',
      'knowledge',
    ],
  },
];

export const ENTITY_CONFIGS: EntityConfig[] = [
  // Party Model - Universal Identity Layer
  {
    type: 'parties',
    label: 'Party',
    labelPlural: 'Parties',
    fields: [
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'party_type', label: 'Type', type: 'string' },
      { key: 'unified_score', label: 'Confidence', type: 'percent' },
      { key: 'id', label: 'ID', type: 'string' },
      { key: 'created_at', label: 'Created', type: 'date' },
    ],
  },
  {
    type: 'leads',
    label: 'Lead',
    labelPlural: 'Leads',
    fields: [
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'email', label: 'Email', type: 'string' },
      { key: 'phone', label: 'Phone', type: 'string' },
      { key: 'company', label: 'Company', type: 'string' },
      { key: 'account_id', label: 'Account', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'rating', label: 'Rating', type: 'string' },
    ],
  },
  {
    type: 'accounts',
    label: 'Account',
    labelPlural: 'Accounts',
    fields: [
      { key: 'name', label: 'Account Name', type: 'string' },
      { key: 'website', label: 'Website', type: 'string' },
      { key: 'industry', label: 'Industry', type: 'string' },
      { key: 'owner', label: 'Owner', type: 'string' },
      { key: 'lifecycle_stage', label: 'Lifecycle Stage', type: 'string' },
      { key: 'created_at', label: 'Created Date', type: 'date' },
    ],
  },
  {
    type: 'contacts',
    label: 'Contact',
    labelPlural: 'Contacts',
    fields: [
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'email', label: 'Email', type: 'string' },
      { key: 'phone', label: 'Phone', type: 'string' },
      { key: 'title', label: 'Title', type: 'string' },
      { key: 'account_id', label: 'Account', type: 'string' },
      { key: 'created_at', label: 'Created Date', type: 'date' },
    ],
  },
  {
    type: 'opportunities',
    label: 'Opportunity',
    labelPlural: 'Opportunities',
    fields: [
      { key: 'name', label: 'Opportunity Name', type: 'string' },
      { key: 'stage', label: 'Stage', type: 'string' },
      { key: 'amount_acv', label: 'Amount', type: 'currency' },
      { key: 'close_date', label: 'Close Date', type: 'date' },
      { key: 'probability', label: 'Probability', type: 'percent' },
      { key: 'account_id', label: 'Account', type: 'string' },
    ],
  },
  {
    type: 'activities',
    label: 'Activity',
    labelPlural: 'Activities',
    fields: [
      { key: 'name', label: 'Subject', type: 'string' },
      { key: 'kind', label: 'Type', type: 'string' },
      { key: 'when_timestamp', label: 'Date', type: 'date' },
      { key: 'duration_min', label: 'Duration (min)', type: 'number' },
      { key: 'summary', label: 'Summary', type: 'string' },
    ],
  },
  {
    type: 'tasks',
    label: 'Task',
    labelPlural: 'Tasks',
    fields: [
      { key: 'name', label: 'Subject', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'priority', label: 'Priority', type: 'string' },
      { key: 'due_date', label: 'Due Date', type: 'date' },
    ],
  },
  {
    type: 'quotes',
    label: 'Quote',
    labelPlural: 'Quotes',
    fields: [
      { key: 'name', label: 'Quote Name', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'amount', label: 'Amount', type: 'currency' },
      { key: 'valid_until', label: 'Valid Until', type: 'date' },
      { key: 'account_id', label: 'Account', type: 'string' },
    ],
  },
  {
    type: 'products',
    label: 'Product',
    labelPlural: 'Products',
    fields: [
      { key: 'name', label: 'Product Name', type: 'string' },
      { key: 'price', label: 'Price', type: 'currency' },
      { key: 'is_active', label: 'Active', type: 'string' },
    ],
  },
  {
    type: 'campaigns',
    label: 'Campaign',
    labelPlural: 'Campaigns',
    fields: [
      { key: 'name', label: 'Campaign Name', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'campaign_type', label: 'Type', type: 'string' },
      { key: 'start_date', label: 'Start Date', type: 'date' },
      { key: 'budget', label: 'Budget', type: 'currency' },
      { key: 'num_leads', label: 'Leads', type: 'number' },
    ],
  },
  {
    type: 'events',
    label: 'Event',
    labelPlural: 'Events',
    fields: [
      { key: 'subject', label: 'Subject', type: 'string' },
      { key: 'start_datetime', label: 'Start Date/Time', type: 'date' },
      { key: 'end_datetime', label: 'End Date/Time', type: 'date' },
      { key: 'location', label: 'Location', type: 'string' },
      { key: 'description', label: 'Description', type: 'string' },
    ],
  },
  {
    type: 'orders',
    label: 'Order',
    labelPlural: 'Orders',
    fields: [
      { key: 'order_number', label: 'Order Number', type: 'string' },
      { key: 'account_id', label: 'Account', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'effective_date', label: 'Effective Date', type: 'date' },
      { key: 'total_amount', label: 'Total Amount', type: 'currency' },
    ],
  },
  {
    type: 'contracts',
    label: 'Contract',
    labelPlural: 'Contracts',
    fields: [
      { key: 'contract_number', label: 'Contract Number', type: 'string' },
      { key: 'account_id', label: 'Account', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'start_date', label: 'Start Date', type: 'date' },
      { key: 'end_date', label: 'End Date', type: 'date' },
      { key: 'total_value', label: 'Total Value', type: 'currency' },
    ],
  },
  {
    type: 'assets',
    label: 'Asset',
    labelPlural: 'Assets',
    fields: [
      { key: 'serial_number', label: 'Serial Number', type: 'string' },
      { key: 'account_id', label: 'Account', type: 'string' },
      { key: 'product_id', label: 'Product', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'purchase_date', label: 'Purchase Date', type: 'date' },
      { key: 'quantity', label: 'Quantity', type: 'number' },
    ],
  },
  {
    type: 'cases',
    label: 'Case',
    labelPlural: 'Cases',
    fields: [
      { key: 'case_number', label: 'Case Number', type: 'string' },
      { key: 'subject', label: 'Subject', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'priority', label: 'Priority', type: 'string' },
      { key: 'origin', label: 'Origin', type: 'string' },
      { key: 'account_id', label: 'Account', type: 'string' },
    ],
  },
  {
    type: 'knowledge',
    label: 'Knowledge Article',
    labelPlural: 'Knowledge',
    fields: [
      { key: 'article_number', label: 'Article Number', type: 'string' },
      { key: 'title', label: 'Title', type: 'string' },
      { key: 'article_type', label: 'Type', type: 'string' },
      { key: 'category', label: 'Category', type: 'string' },
      { key: 'is_published', label: 'Published', type: 'string' },
      { key: 'summary', label: 'Summary', type: 'string' },
    ],
  },
  // Party Model entities
  {
    type: 'individuals',
    label: 'Individual',
    labelPlural: 'Individuals',
    fields: [
      { key: 'person_name', label: 'Name', type: 'string' },
      { key: 'person_given_name', label: 'First Name', type: 'string' },
      { key: 'person_family_name', label: 'Last Name', type: 'string' },
      { key: 'birth_date', label: 'Birth Date', type: 'date' },
    ],
  },
  {
    type: 'organizations',
    label: 'Organization',
    labelPlural: 'Organizations',
    fields: [
      { key: 'business_name', label: 'Business Name', type: 'string' },
      { key: 'legal_name', label: 'Legal Name', type: 'string' },
      { key: 'website', label: 'Website', type: 'string' },
      { key: 'industry', label: 'Industry', type: 'string' },
      { key: 'employee_count', label: 'Employees', type: 'number' },
    ],
  },
  {
    type: 'households',
    label: 'Household',
    labelPlural: 'Households',
    fields: [
      { key: 'household_name', label: 'Name', type: 'string' },
      { key: 'household_type', label: 'Type', type: 'string' },
    ],
  },
  // Research Intelligence entities
  {
    type: 'researcher-profiles',
    label: 'Researcher Profile',
    labelPlural: 'Researcher Profiles',
    fields: [
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'current_institution', label: 'Institution', type: 'string' },
      { key: 'current_position', label: 'Position', type: 'string' },
      { key: 'primary_research_area', label: 'Research Area', type: 'string' },
      { key: 'lead_score', label: 'Lead Score', type: 'number' },
      { key: 'lead_temperature', label: 'Temperature', type: 'string' },
      { key: 'orcid_id', label: 'ORCID', type: 'string' },
      { key: 'h_index', label: 'H-Index', type: 'number' },
      { key: 'total_citations', label: 'Citations', type: 'number' },
      { key: 'publications_count', label: 'Publications', type: 'number' },
      { key: 'total_funding_usd', label: 'Funding', type: 'currency' },
      { key: 'lab_size', label: 'Lab Size', type: 'number' },
    ],
  },
  {
    type: 'organization-profiles',
    label: 'Organization Profile',
    labelPlural: 'Organization Profiles',
    fields: [
      { key: 'institution_type', label: 'Type', type: 'string' },
      { key: 'carnegie_classification', label: 'Carnegie', type: 'string' },
      { key: 'is_r1_institution', label: 'R1 Institution', type: 'string' },
      { key: 'total_research_funding_usd', label: 'Research Funding', type: 'currency' },
      { key: 'nih_rank', label: 'NIH Rank', type: 'number' },
      { key: 'customer_count', label: 'Customers', type: 'number' },
      { key: 'prospect_count', label: 'Prospects', type: 'number' },
    ],
  },
  {
    type: 'party-sources',
    label: 'Party Source',
    labelPlural: 'Party Sources',
    fields: [
      { key: 'source_type', label: 'Type', type: 'string' },
      { key: 'source_name', label: 'Source', type: 'string' },
      { key: 'import_batch_id', label: 'Batch ID', type: 'string' },
      { key: 'import_date', label: 'Import Date', type: 'date' },
      { key: 'data_quality_score', label: 'Quality Score', type: 'number' },
      { key: 'enrichment_attempts', label: 'Enrichment Attempts', type: 'number' },
      { key: 'last_enrichment_date', label: 'Last Enriched', type: 'date' },
    ],
  },
  {
    type: 'party-engagements',
    label: 'Party Engagement',
    labelPlural: 'Party Engagements',
    fields: [
      { key: 'lead_score', label: 'Lead Score', type: 'number' },
      { key: 'lead_temperature', label: 'Temperature', type: 'string' },
      { key: 'pipeline_stage', label: 'Stage', type: 'string' },
      { key: 'email_opens', label: 'Email Opens', type: 'number' },
      { key: 'email_clicks', label: 'Email Clicks', type: 'number' },
      { key: 'webinar_attendances', label: 'Webinars', type: 'number' },
      { key: 'demo_requests', label: 'Demos', type: 'number' },
    ],
  },
];
