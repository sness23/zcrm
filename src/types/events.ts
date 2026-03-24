/**
 * Event Types
 * These define the shape of all event log messages
 */

import type { Entity, EntityType } from './entities.js'

// Event types
export type EventType = 'create' | 'update' | 'delete' | 'bulk'

// Event status
export type EventStatus = 'pending' | 'applied' | 'failed'

// Base event structure
export interface BaseEvent {
  id: string // evt_xxx
  timestamp: string // ISO 8601
  type: EventType
  status: EventStatus
  error?: string
}

// Create event
export interface CreateEvent extends BaseEvent {
  type: 'create'
  entity_type: EntityType
  data: Partial<Entity> // Partial because ID and type can be auto-generated
}

// Update event
export interface UpdateEvent extends BaseEvent {
  type: 'update'
  entity_id: string
  entity_type?: EntityType // Optional, can be inferred from ID
  changes: Partial<Entity> // Fields to update
}

// Delete event
export interface DeleteEvent extends BaseEvent {
  type: 'delete'
  entity_id: string
  entity_type?: EntityType
}

// Bulk event (multiple operations)
export interface BulkEvent extends BaseEvent {
  type: 'bulk'
  operations: Event[]
}

// Union type of all events
export type Event = CreateEvent | UpdateEvent | DeleteEvent | BulkEvent

// Event log entry (as stored in markdown)
export interface EventLogEntry {
  id: string
  timestamp: string
  type: EventType
  status: EventStatus
  entity_type?: EntityType
  entity_id?: string
  data?: Partial<Entity>
  changes?: Partial<Entity>
  operations?: Event[]
  diff?: string
  error?: string
  file_path?: string
}

// API request bodies
export interface CreateEventRequest {
  type: 'create'
  entity_type: EntityType
  data: Partial<Entity>
}

export interface UpdateEventRequest {
  type: 'update'
  entity_id: string
  changes: Partial<Entity>
}

export interface DeleteEventRequest {
  type: 'delete'
  entity_id: string
}

export interface BulkEventRequest {
  type: 'bulk'
  operations: (CreateEventRequest | UpdateEventRequest | DeleteEventRequest)[]
}

export type EventRequest =
  | CreateEventRequest
  | UpdateEventRequest
  | DeleteEventRequest
  | BulkEventRequest

// API response
export interface EventResponse {
  event_id: string
  status: 'queued'
  timestamp: string
  warnings?: string[]
}

// Validation result
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
