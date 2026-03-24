export type EntityType =
  | 'account'
  | 'contact'
  | 'opportunity'
  | 'lead'
  | 'activity'
  | 'task'
  | 'quote'
  | 'product'
  | 'campaign'
  | 'event'
  | 'order'
  | 'contract'
  | 'asset'
  | 'case'
  | 'knowledge';

export interface Entity {
  id: string;
  type: EntityType;
  slug: string;
  name: string;
  metadata?: Record<string, any>;
}

export interface EntityStats {
  total: number;
  byType: Record<EntityType, number>;
}
