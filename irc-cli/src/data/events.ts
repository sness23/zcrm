import fs from 'fs';
import path from 'path';
import { format, subDays } from 'date-fns';
import type { Event } from '../types/event.js';
import { EventParser } from '../utils/parser.js';

export class EventManager {
  private parser: EventParser;
  private vaultPath: string;
  private events: Map<string, Event> = new Map();

  constructor(vaultPath: string) {
    this.parser = new EventParser();
    this.vaultPath = vaultPath;
  }

  // Load events from log files (last N days)
  async loadEvents(days: number = 7): Promise<Event[]> {
    const events: Event[] = [];
    const logsDir = path.join(this.vaultPath, '_logs');

    if (!fs.existsSync(logsDir)) {
      console.error(`Logs directory not found: ${logsDir}`);
      return events;
    }

    // Generate file names for last N days
    const logFiles: string[] = [];
    for (let i = 0; i < days; i++) {
      const date = subDays(new Date(), i);
      const fileName = `events-${format(date, 'yyyy-MM-dd')}.md`;
      const filePath = path.join(logsDir, fileName);

      if (fs.existsSync(filePath)) {
        logFiles.push(filePath);
      }
    }

    // Parse all log files
    for (const filePath of logFiles) {
      const fileEvents = this.parser.parseLogFile(filePath);
      events.push(...fileEvents);

      // Store in map by ID
      for (const event of fileEvents) {
        if (event.id) {
          this.events.set(event.id, event);
        }
      }
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return events;
  }

  // Get events for specific entity
  getEventsForEntity(entityType: string, entitySlug: string): Event[] {
    const filtered: Event[] = [];

    for (const event of this.events.values()) {
      if (
        event.entity_type === entityType &&
        (event.entity_slug === entitySlug || event.entity_id.includes(entitySlug))
      ) {
        filtered.push(event);
      }
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Get event by ID
  getEventById(id: string): Event | undefined {
    return this.events.get(id);
  }

  // Get all events
  getAllEvents(): Event[] {
    return Array.from(this.events.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  // Filter events by status
  filterByStatus(status: string): Event[] {
    return Array.from(this.events.values())
      .filter(e => e.status === status)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Filter events by action
  filterByAction(action: string): Event[] {
    return Array.from(this.events.values())
      .filter(e => e.action === action)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Search events by text
  searchEvents(query: string): Event[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.events.values())
      .filter(e => {
        return (
          e.message.toLowerCase().includes(lowerQuery) ||
          e.entity_type.toLowerCase().includes(lowerQuery) ||
          (e.entity_slug && e.entity_slug.toLowerCase().includes(lowerQuery)) ||
          JSON.stringify(e.details).toLowerCase().includes(lowerQuery)
        );
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Add new event
  addEvent(event: Event) {
    if (event.id) {
      this.events.set(event.id, event);
    }
  }

  // Clear all events
  clear() {
    this.events.clear();
  }

  // Get event count
  getCount(): number {
    return this.events.size;
  }

  // Get today's log file path
  getTodayLogPath(): string {
    const today = format(new Date(), 'yyyy-MM-dd');
    return path.join(this.vaultPath, '_logs', `events-${today}.md`);
  }
}
