import fs from "fs";
import path from "path";
import { ulid } from "ulidx";
import matter from "gray-matter";

export type EventType = "create" | "update" | "delete" | "bulk";
export type EventStatus = "pending" | "applied" | "failed";

export interface Event {
  id: string;
  timestamp: string;
  type: EventType;
  entity_type?: string;
  entity_id?: string;
  data?: any;
  changes?: any;
  operations?: any[];
  status: EventStatus;
  error?: string;
  file_path?: string;
  diff?: string;
}

export class EventLog {
  private logDir: string;

  constructor(vaultPath: string) {
    this.logDir = path.join(vaultPath, "_logs");
    fs.mkdirSync(this.logDir, { recursive: true });
  }

  /**
   * Get the log file path for a given date
   */
  private getLogPath(date: Date = new Date()): string {
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
    return path.join(this.logDir, `events-${dateStr}.md`);
  }

  /**
   * Create a new event and append it to the log
   */
  async createEvent(
    type: EventType,
    payload: {
      entity_type?: string;
      entity_id?: string;
      data?: any;
      changes?: any;
      operations?: any[];
    }
  ): Promise<Event> {
    const event: Event = {
      id: "evt_" + ulid().toLowerCase(),
      timestamp: new Date().toISOString(),
      type,
      ...payload,
      status: "pending",
    };

    await this.appendEvent(event);
    return event;
  }

  /**
   * Append an event to the log file
   */
  private async appendEvent(event: Event): Promise<void> {
    const logPath = this.getLogPath();

    // Create log file with header if it doesn't exist
    if (!fs.existsSync(logPath)) {
      const date = new Date().toISOString().slice(0, 10);
      fs.writeFileSync(logPath, `# CRM Event Log - ${date}\n\n`, "utf8");
    }

    // Format event as markdown
    const eventMd = this.formatEventAsMarkdown(event);

    // Append to file
    fs.appendFileSync(logPath, eventMd + "\n", "utf8");
  }

  /**
   * Format an event as markdown
   */
  private formatEventAsMarkdown(event: Event): string {
    let md = `## Event ${event.id}\n\n`;
    md += `**Timestamp:** ${event.timestamp}\n`;
    md += `**Type:** ${event.type}\n`;

    if (event.entity_type) {
      md += `**Entity:** ${event.entity_type}\n`;
    }

    if (event.entity_id) {
      md += `**Entity ID:** ${event.entity_id}\n`;
    }

    if (event.file_path) {
      md += `**File:** ${event.file_path}\n`;
    }

    md += `**Status:** ${event.status}\n`;

    if (event.data) {
      // Escape backticks in JSON strings to prevent markdown parsing issues
      const dataJson = JSON.stringify(event.data, null, 2).replace(/```/g, '\\`\\`\\`');
      md += `\n### Data\n\n\`\`\`json\n${dataJson}\n\`\`\`\n`;
    }

    if (event.changes) {
      const changesJson = JSON.stringify(event.changes, null, 2).replace(/```/g, '\\`\\`\\`');
      md += `\n### Changes\n\n\`\`\`json\n${changesJson}\n\`\`\`\n`;
    }

    if (event.operations) {
      const opsJson = JSON.stringify(event.operations, null, 2).replace(/```/g, '\\`\\`\\`');
      md += `\n### Operations\n\n\`\`\`json\n${opsJson}\n\`\`\`\n`;
    }

    if (event.diff) {
      md += `\n### Diff\n\n\`\`\`diff\n${event.diff}\n\`\`\`\n`;
    }

    if (event.error) {
      md += `\n### Error\n\n${event.error}\n`;
    }

    md += `\n---\n`;

    return md;
  }

  /**
   * Read all events from today's log
   */
  async readEvents(date: Date = new Date()): Promise<Event[]> {
    const logPath = this.getLogPath(date);

    if (!fs.existsSync(logPath)) {
      return [];
    }

    const content = fs.readFileSync(logPath, "utf8");
    return this.parseEventsFromMarkdown(content);
  }

  /**
   * Parse events from markdown content
   */
  private parseEventsFromMarkdown(content: string): Event[] {
    const events: Event[] = [];

    // Split by event headers
    const eventSections = content.split(/^## Event /m).slice(1); // Skip header

    for (const section of eventSections) {
      try {
        const lines = section.trim().split("\n");
        const id = lines[0].trim();

        const event: Partial<Event> = { id };

        // Parse fields
        for (const line of lines) {
          if (line.startsWith("**Timestamp:**")) {
            event.timestamp = line.replace("**Timestamp:**", "").trim();
          } else if (line.startsWith("**Type:**")) {
            event.type = line.replace("**Type:**", "").trim() as EventType;
          } else if (line.startsWith("**Entity:**")) {
            event.entity_type = line.replace("**Entity:**", "").trim();
          } else if (line.startsWith("**Entity ID:**")) {
            event.entity_id = line.replace("**Entity ID:**", "").trim();
          } else if (line.startsWith("**File:**")) {
            event.file_path = line.replace("**File:**", "").trim();
          } else if (line.startsWith("**Status:**")) {
            event.status = line.replace("**Status:**", "").trim() as EventStatus;
          }
        }

        // Extract JSON blocks
        const dataMatch = section.match(/### Data\n\n```json\n([\s\S]*?)```/);
        if (dataMatch) {
          try {
            // Unescape backticks before parsing
            const unescaped = dataMatch[1].replace(/\\`\\`\\`/g, '```');
            event.data = JSON.parse(unescaped);
          } catch (e) {
            // Skip corrupted JSON data block, but continue parsing the event
            console.warn(`Skipping corrupted data JSON for event ${id}`);
          }
        }

        const changesMatch = section.match(/### Changes\n\n```json\n([\s\S]*?)```/);
        if (changesMatch) {
          try {
            const unescaped = changesMatch[1].replace(/\\`\\`\\`/g, '```');
            event.changes = JSON.parse(unescaped);
          } catch (e) {
            console.warn(`Skipping corrupted changes JSON for event ${id}`);
          }
        }

        const opsMatch = section.match(/### Operations\n\n```json\n([\s\S]*?)```/);
        if (opsMatch) {
          try {
            const unescaped = opsMatch[1].replace(/\\`\\`\\`/g, '```');
            event.operations = JSON.parse(unescaped);
          } catch (e) {
            console.warn(`Skipping corrupted operations JSON for event ${id}`);
          }
        }

        const diffMatch = section.match(/### Diff\n\n```diff\n([\s\S]*?)```/);
        if (diffMatch) {
          event.diff = diffMatch[1].trim();
        }

        const errorMatch = section.match(/### Error\n\n(.*?)(?=\n---|$)/s);
        if (errorMatch) {
          event.error = errorMatch[1].trim();
        }

        if (event.id && event.timestamp && event.type && event.status) {
          events.push(event as Event);
        }
      } catch (e) {
        // Skip this entire event if parsing fails completely
        console.warn(`Skipping corrupted event section:`, e);
        continue;
      }
    }

    return events;
  }

  /**
   * Get pending events (status = pending)
   */
  async getPendingEvents(date: Date = new Date()): Promise<Event[]> {
    const events = await this.readEvents(date);
    return events.filter((e) => e.status === "pending");
  }

  /**
   * Update event status in the log
   */
  async updateEventStatus(
    eventId: string,
    status: EventStatus,
    error?: string,
    date?: Date
  ): Promise<void> {
    // If no date provided, search recent days for the event
    if (!date) {
      // Try today first
      date = new Date();
      let logPath = this.getLogPath(date);

      if (!fs.existsSync(logPath) || !fs.readFileSync(logPath, "utf8").includes(eventId)) {
        // Search last 7 days
        let found = false;
        for (let i = 1; i < 7; i++) {
          const checkDate = new Date();
          checkDate.setDate(checkDate.getDate() - i);
          logPath = this.getLogPath(checkDate);

          if (fs.existsSync(logPath) && fs.readFileSync(logPath, "utf8").includes(eventId)) {
            date = checkDate;
            found = true;
            break;
          }
        }

        if (!found) {
          throw new Error(`Event ${eventId} not found in any recent log`);
        }
      }
    }

    const logPath = this.getLogPath(date);

    if (!fs.existsSync(logPath)) {
      throw new Error(`Log file not found: ${logPath}`);
    }

    let content = fs.readFileSync(logPath, "utf8");

    // Find the event and update its status
    const eventPattern = new RegExp(
      `(## Event ${eventId}[\\s\\S]*?\\*\\*Status:\\*\\*) pending`,
      "m"
    );

    if (eventPattern.test(content)) {
      content = content.replace(eventPattern, `$1 ${status}`);

      // Add error if failed
      if (status === "failed" && error) {
        const errorSection = `\n### Error\n\n${error}\n`;
        const insertPattern = new RegExp(
          `(## Event ${eventId}[\\s\\S]*?)(\\n---\\n)`,
          "m"
        );
        content = content.replace(insertPattern, `$1${errorSection}$2`);
      }

      fs.writeFileSync(logPath, content, "utf8");
    } else {
      throw new Error(`Event ${eventId} not found in log`);
    }
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId: string, date: Date = new Date()): Promise<Event | null> {
    const events = await this.readEvents(date);
    return events.find((e) => e.id === eventId) || null;
  }

  /**
   * Get recent events across multiple days
   */
  async getRecentEvents(days: number = 7, status?: EventStatus): Promise<Event[]> {
    const events: Event[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      const dayEvents = await this.readEvents(date);
      events.push(...dayEvents);
    }

    if (status) {
      return events.filter((e) => e.status === status);
    }

    return events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
}
