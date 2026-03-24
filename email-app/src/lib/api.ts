/**
 * API helper for email-app
 */

const API_BASE = 'http://localhost:9600'

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body_md: string
  from_name?: string
  from_email?: string
  category?: string
  merge_fields?: string[]
  status: string
  created_at: string
  updated_at: string
}

export interface EmailDraft {
  id: string
  template_id?: string
  contact_id?: string
  party_id?: string
  to_email: string
  to_name?: string
  subject: string
  body_html?: string
  body_md?: string
  gmail_draft_id?: string
  gmail_message_id?: string
  gmail_thread_id?: string
  status: string
  created_at: string
  updated_at: string
}

export interface Party {
  id: string
  name: string
  email?: string
  type: string
}

export interface GmailStatus {
  connected: boolean
  email?: string
}

// Gmail API
export async function getGmailStatus(): Promise<GmailStatus> {
  const res = await fetch(`${API_BASE}/api/gmail/status`)
  if (!res.ok) throw new Error('Failed to get Gmail status')
  return res.json()
}

export function getGmailAuthUrl(): string {
  return `${API_BASE}/api/gmail/auth`
}

export async function disconnectGmail(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/gmail/disconnect`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to disconnect Gmail')
}

// Templates API
export async function getTemplates(): Promise<EmailTemplate[]> {
  const res = await fetch(`${API_BASE}/api/email/templates`)
  if (!res.ok) throw new Error('Failed to fetch templates')
  const data = await res.json()
  return data.templates
}

export async function getTemplate(id: string): Promise<EmailTemplate> {
  const res = await fetch(`${API_BASE}/api/email/templates/${id}`)
  if (!res.ok) throw new Error('Failed to fetch template')
  return res.json()
}

export async function createTemplate(template: Partial<EmailTemplate>): Promise<EmailTemplate> {
  const res = await fetch(`${API_BASE}/api/email/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template)
  })
  if (!res.ok) throw new Error('Failed to create template')
  return res.json()
}

export async function updateTemplate(id: string, template: Partial<EmailTemplate>): Promise<EmailTemplate> {
  const res = await fetch(`${API_BASE}/api/email/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template)
  })
  if (!res.ok) throw new Error('Failed to update template')
  return res.json()
}

// Drafts API
export async function getDrafts(): Promise<EmailDraft[]> {
  const res = await fetch(`${API_BASE}/api/email/drafts`)
  if (!res.ok) throw new Error('Failed to fetch drafts')
  const data = await res.json()
  return data.drafts
}

export async function createDraft(draft: {
  template_id?: string
  contact_id?: string
  party_id?: string
  to_email: string
  to_name?: string
  merge_data?: Record<string, string>
}): Promise<EmailDraft> {
  const res = await fetch(`${API_BASE}/api/gmail/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft)
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to create draft')
  }
  return res.json()
}

// Render email preview
export async function renderEmail(templateId: string, mergeData: Record<string, string>): Promise<{ subject: string, body_html: string }> {
  const res = await fetch(`${API_BASE}/api/email/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: templateId, merge_data: mergeData })
  })
  if (!res.ok) throw new Error('Failed to render email')
  return res.json()
}

// Parties API (for recipient picker)
export async function getParties(): Promise<Party[]> {
  const res = await fetch(`${API_BASE}/api/entities/parties`)
  if (!res.ok) throw new Error('Failed to fetch parties')
  const data = await res.json()
  return data.entities
}

export async function searchParties(query: string): Promise<Party[]> {
  const res = await fetch(`${API_BASE}/api/entities/parties?search=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Failed to search parties')
  const data = await res.json()
  return data.entities
}
