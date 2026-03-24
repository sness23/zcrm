export type EventStatus = 'pending' | 'applied' | 'failed';

export type EventAction = 'create' | 'update' | 'delete' | 'sync' | 'error';

export interface Event {
  id: string;
  timestamp: Date;
  action: EventAction;
  entity_type: string;
  entity_id: string;
  entity_slug?: string;
  status: EventStatus;
  message: string;
  details?: Record<string, any>;
  error?: string;
  raw?: string;
}

export interface ParsedEvent extends Event {
  formattedTimestamp: string;
  formattedDate: string;
  emoji: string;
  color: string;
}
