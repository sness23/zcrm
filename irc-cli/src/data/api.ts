import type { Event } from '../types/event.js';
import type { Entity } from '../types/entity.js';

export class APIClient {
  private baseUrl: string;
  private connected: boolean = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  // Check API connectivity
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      this.connected = response.ok;
      return this.connected;
    } catch (error) {
      this.connected = false;
      return false;
    }
  }

  // Get recent events
  async getEvents(days: number = 7, limit: number = 100): Promise<Event[]> {
    try {
      const url = `${this.baseUrl}/api/events?days=${days}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return this.normalizeEvents(data.events || data);
    } catch (error) {
      console.error('Failed to fetch events from API:', error);
      return [];
    }
  }

  // Get entities by type
  async getEntities(type: string, limit: number = 50): Promise<Entity[]> {
    try {
      const url = `${this.baseUrl}/api/entities/${type}?limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.entities || data;
    } catch (error) {
      console.error(`Failed to fetch ${type} from API:`, error);
      return [];
    }
  }

  // Get specific entity
  async getEntity(type: string, id: string): Promise<Entity | null> {
    try {
      const url = `${this.baseUrl}/api/entities/${type}/${id}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data as Entity;
    } catch (error) {
      console.error(`Failed to fetch entity ${type}/${id}:`, error);
      return null;
    }
  }

  // Get statistics
  async getStats(): Promise<any> {
    try {
      const url = `${this.baseUrl}/api/stats`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch stats from API:', error);
      return null;
    }
  }

  // Search entities
  async search(query: string): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/api/search?q=${encodeURIComponent(query)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.results || data;
    } catch (error) {
      console.error('Failed to search API:', error);
      return [];
    }
  }

  // Normalize events from API response
  private normalizeEvents(rawEvents: any[]): Event[] {
    return rawEvents.map(e => ({
      id: e.id || e.event_id || '',
      timestamp: new Date(e.timestamp),
      action: e.action || 'update',
      entity_type: e.entity_type || e.type || '',
      entity_id: e.entity_id || e.id || '',
      entity_slug: e.entity_slug || e.slug,
      status: e.status || 'pending',
      message: e.message || e.summary || '',
      details: e.details || e,
      error: e.error
    }));
  }

  // Check if connected
  isConnected(): boolean {
    return this.connected;
  }
}
