export type HistoryEventType =
  | 'chat'
  | 'field-change'
  | 'activity'
  | 'email'
  | 'phone'
  | 'note'
  | 'system'
  | 'opportunity'
  | 'case'

export interface HistoryEvent {
  id: string
  partyId: string
  type: HistoryEventType
  timestamp: string
  actor: {
    id?: string
    name: string
    avatar?: string
  }

  // Content varies by type
  content: ChatContent | FieldChangeContent | ActivityContent | EmailContent | SystemContent

  // Optional expandable details
  details?: any

  // For grouping and filtering
  metadata?: {
    source?: string
    relatedRecordId?: string
    relatedRecordType?: string
  }
}

export interface ChatContent {
  message: string
  mentions?: string[]
  attachments?: Array<{
    name: string
    url: string
    type: string
  }>
}

export interface FieldChangeContent {
  changes: Array<{
    field: string
    oldValue: any
    newValue: any
  }>
}

export interface ActivityContent {
  activityType: 'meeting' | 'call' | 'email' | 'task'
  subject: string
  duration?: number
  attendees?: string[]
  notes?: string
}

export interface EmailContent {
  subject: string
  to: string[]
  from: string
  preview: string
  fullBody?: string
}

export interface SystemContent {
  action: 'created' | 'updated' | 'deleted' | 'assigned'
  description: string
}
