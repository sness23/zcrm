import fs from 'fs';
import matter from 'gray-matter';
import type { Event, EventStatus, EventAction } from '../types/event.js';

export class EventParser {
  // Parse a single event log file
  parseLogFile(filePath: string): Event[] {
    try {
      if (!fs.existsSync(filePath)) {
        return [];
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      return this.parseLogContent(content);
    } catch (error) {
      console.error(`Failed to parse log file ${filePath}:`, error);
      return [];
    }
  }

  // Parse log content
  parseLogContent(content: string): Event[] {
    const events: Event[] = [];

    // Split by event markers (##)
    const sections = content.split(/^## /gm).filter(s => s.trim());

    for (const section of sections) {
      const event = this.parseEventSection(section);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  // Parse a single event section
  private parseEventSection(section: string): Event | null {
    try {
      // Parse frontmatter if present
      const parsed = matter(`---\n${section}`);
      const { data } = parsed;

      // Extract event details
      const event: Event = {
        id: data.id || data.event_id || '',
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        action: data.action || 'update',
        entity_type: data.entity_type || data.type || '',
        entity_id: data.entity_id || data.id || '',
        entity_slug: data.entity_slug || data.slug,
        status: data.status || 'pending',
        message: data.message || data.summary || '',
        details: data.details || data,
        error: data.error,
        raw: section
      };

      return event;
    } catch (error) {
      // Try to extract basic info from plain text
      return this.parseEventText(section);
    }
  }

  // Parse event from plain text (fallback)
  private parseEventText(text: string): Event | null {
    try {
      const lines = text.split('\n');
      const firstLine = lines[0] || '';

      // Try to extract timestamp and action
      const timestampMatch = firstLine.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
      const actionMatch = firstLine.match(/(Created|Updated|Deleted|Synced)/i);

      return {
        id: '',
        timestamp: timestampMatch ? new Date(timestampMatch[1]) : new Date(),
        action: actionMatch ? actionMatch[1].toLowerCase() as EventAction : 'update',
        entity_type: '',
        entity_id: '',
        status: 'pending',
        message: firstLine,
        raw: text
      };
    } catch {
      return null;
    }
  }

  // Extract event ID from various formats
  extractEventId(data: any): string {
    return data.event_id || data.id || data._id || '';
  }

  // Extract entity info
  extractEntityInfo(data: any): { type: string; id: string; slug?: string } {
    return {
      type: data.entity_type || data.type || '',
      id: data.entity_id || data.id || '',
      slug: data.entity_slug || data.slug
    };
  }

  // Determine event status
  determineStatus(data: any): EventStatus {
    if (data.status) {
      return data.status;
    }
    if (data.error) {
      return 'failed';
    }
    if (data.applied || data.completed) {
      return 'applied';
    }
    return 'pending';
  }
}
