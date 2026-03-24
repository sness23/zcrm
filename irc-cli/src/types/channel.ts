import type { Event } from './event.js';
import type { EntityType } from './entity.js';

export type ChannelType = 'system' | 'entity' | 'pinned' | 'virtual';

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  entityType?: EntityType;
  entitySlug?: string;
  entityId?: string;
  events: Event[];
  unreadCount: number;
  isPinned: boolean;
  isActive: boolean;
}

export interface ChannelGroup {
  title: string;
  channels: Channel[];
  collapsed: boolean;
}
