/**
 * Entity Types
 * These define the shape of all CRM entities
 */

// Base entity fields
export interface BaseEntity {
  id: string
  type: string
  name: string
  created_at?: string
  updated_at?: string
}

// Account
export interface Account extends BaseEntity {
  type: 'Account'
  website?: string
  industry?: string
  owner?: string
  lifecycle_stage?: 'prospect' | 'customer' | 'partner' | 'former_customer'
  created?: string
}

// Contact
export interface Contact extends BaseEntity {
  type: 'Contact'
  account?: string // Wikilink: [[accounts/slug]]
  first_name: string
  last_name: string
  email?: string
  phone?: string
  title?: string
}

// Opportunity
export interface Opportunity extends BaseEntity {
  type: 'Opportunity'
  account?: string // Wikilink: [[accounts/slug]]
  stage?: 'discovery' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
  amount_acv?: number
  close_date?: string
  probability?: number
  next_action?: string
}

// Lead
export interface Lead extends BaseEntity {
  type: 'Lead'
  email?: string
  phone?: string
  company?: string
  status?: 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted'
  rating?: 'hot' | 'warm' | 'cold'
}

// Activity
export interface Activity extends BaseEntity {
  type: 'Activity'
  kind?: 'note' | 'call' | 'email' | 'meeting'
  when?: string // ISO timestamp
  summary?: string
  duration_min?: number
}

// Task
export interface Task extends BaseEntity {
  type: 'Task'
  subject?: string
  status?: 'not_started' | 'in_progress' | 'completed' | 'cancelled'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  due_date?: string
}

// Quote
export interface Quote extends BaseEntity {
  type: 'Quote'
  opportunity?: string // Wikilink
  account?: string // Wikilink
  status?: 'draft' | 'sent' | 'accepted' | 'rejected'
  amount?: number
  valid_until?: string
}

// Product
export interface Product extends BaseEntity {
  type: 'Product'
  price?: number
  is_active?: boolean
}

// Campaign
export interface Campaign extends BaseEntity {
  type: 'Campaign'
  status?: 'planned' | 'active' | 'completed' | 'cancelled'
  campaign_type?: 'email' | 'webinar' | 'event' | 'social' | 'other'
  start_date?: string
  budget?: number
  num_leads?: number
}

// Union type of all entities
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

// Entity type names
export type EntityType =
  | 'Account'
  | 'Contact'
  | 'Opportunity'
  | 'Lead'
  | 'Activity'
  | 'Task'
  | 'Quote'
  | 'Product'
  | 'Campaign'
