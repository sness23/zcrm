import blessed from 'blessed';
import fs from 'fs';
import path from 'path';
import { format, subDays, isToday, isYesterday } from 'date-fns';
import chokidar from 'chokidar';
import matter from 'gray-matter';

interface Event {
  id: string;
  timestamp: Date;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_slug?: string;
  status: string;
  message: string;
  details?: any;
  error?: string;
}

interface ViewerOptions {
  vaultPath: string;
  days: number;
  watch: boolean;
}

export class LogViewer {
  private screen: blessed.Widgets.Screen;
  private log: blessed.Widgets.Log;
  private statusBar: blessed.Widgets.BoxElement;
  private options: ViewerOptions;
  private watcher?: chokidar.FSWatcher;
  private eventCount = 0;
  private lastPosition: Map<string, number> = new Map();

  constructor(options: ViewerOptions) {
    this.options = options;

    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'FS-CRM Log Viewer',
      fullUnicode: true
    });

    // Create log display
    this.log = blessed.log({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%-1',
      scrollable: true,
      alwaysScroll: false,  // Changed to false so we can control scrolling
      mouse: true,
      keys: true,
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      },
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'grey'
        },
        style: {
          inverse: true
        }
      },
      label: ' FS-CRM Event Log '
    });

    // Create status bar
    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      tags: true,
      style: {
        fg: 'black',
        bg: 'white'
      }
    });

    // Setup keyboard shortcuts
    this.setupKeys();

    // Initial status
    this.updateStatus();
  }

  private setupKeys() {
    // Quit on q, Ctrl+C, Ctrl+Q
    this.screen.key(['q', 'C-c', 'C-q'], () => {
      this.stop();
      process.exit(0);
    });

    // Scroll
    this.screen.key(['up'], () => {
      this.log.scroll(-1);
      this.screen.render();
    });

    this.screen.key(['down'], () => {
      this.log.scroll(1);
      this.screen.render();
    });

    this.screen.key(['pageup'], () => {
      this.log.scroll(-10);
      this.screen.render();
    });

    this.screen.key(['pagedown'], () => {
      this.log.scroll(10);
      this.screen.render();
    });

    this.screen.key(['home'], () => {
      this.log.setScrollPerc(0);
      this.screen.render();
    });

    this.screen.key(['end'], () => {
      this.log.setScrollPerc(100);
      this.screen.render();
    });

    // Refresh
    this.screen.key(['r', 'C-r'], async () => {
      await this.refresh();
    });
  }

  async start() {
    // Load initial events
    this.log.log('{cyan-fg}Loading events...{/cyan-fg}');
    this.screen.render();

    const events = await this.loadEvents();
    this.displayEvents(events);

    // Start watching if enabled
    if (this.options.watch) {
      this.startWatching();
    }

    this.updateStatus();
    this.screen.render();
  }

  private async loadEvents(): Promise<Event[]> {
    const events: Event[] = [];
    const logsDir = path.join(this.options.vaultPath, '_logs');

    if (!fs.existsSync(logsDir)) {
      this.log.log(`{red-fg}Error: Logs directory not found: ${logsDir}{/red-fg}`);
      return events;
    }

    // Load last N days
    for (let i = 0; i < this.options.days; i++) {
      const date = subDays(new Date(), i);
      const fileName = `events-${format(date, 'yyyy-MM-dd')}.md`;
      const filePath = path.join(logsDir, fileName);

      if (fs.existsSync(filePath)) {
        const fileEvents = this.parseLogFile(filePath);
        events.push(...fileEvents);
      }
    }

    // Sort by timestamp (oldest first for display)
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    this.eventCount = events.length;
    return events;
  }

  private parseLogFile(filePath: string): Event[] {
    const events: Event[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Split by event markers (##)
      const sections = content.split(/^## /gm).filter(s => s.trim());

      for (const section of sections) {
        try {
          const parsed = matter(`---\n${section}`);
          const data = parsed.data;

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
            error: data.error
          };

          events.push(event);
        } catch {
          // Skip malformed events
        }
      }
    } catch (error) {
      this.log.log(`{red-fg}Error parsing ${filePath}: ${error}{/red-fg}`);
    }

    return events;
  }

  private displayEvents(events: Event[]) {
    let currentDate = '';

    for (const event of events) {
      // Add date divider
      const eventDate = this.formatDate(event.timestamp);
      if (eventDate !== currentDate) {
        currentDate = eventDate;
        const divider = this.createDateDivider(eventDate);
        this.log.log(divider);
        this.log.log('');
      }

      // Display event
      const formatted = this.formatEvent(event);
      this.log.log(formatted);
      this.log.log('');
    }

    // Scroll to bottom after initial load
    this.log.setScrollPerc(100);
  }

  private formatEvent(event: Event): string {
    const time = format(event.timestamp, 'HH:mm:ss');
    const emoji = this.getEmoji(event.action);
    const statusColor = this.getStatusColor(event.status);
    const actionColor = this.getActionColor(event.action);

    let output = `{grey-fg}${time}{/grey-fg} {${actionColor}-fg}${emoji} ${event.message}{/${actionColor}-fg}`;

    // Add details
    if (event.details) {
      const keys = Object.keys(event.details).filter(
        k => !['id', 'timestamp', 'status', 'action', 'message'].includes(k)
      );

      for (const key of keys.slice(0, 3)) { // Limit to 3 detail lines
        const value = event.details[key];
        if (value && typeof value !== 'object') {
          output += `\n         {grey-fg}${key}:{/grey-fg} ${value}`;
        }
      }
    }

    // Add status
    output += `\n         {${statusColor}-fg}[${event.status}]{/${statusColor}-fg}`;
    if (event.id) {
      output += ` {grey-fg}[${event.id.substring(0, 12)}...]{/grey-fg}`;
    }

    return output;
  }

  private formatDate(date: Date): string {
    if (isToday(date)) {
      return 'Today';
    }
    if (isYesterday(date)) {
      return 'Yesterday';
    }
    return format(date, 'MMM dd');
  }

  private createDateDivider(dateStr: string): string {
    const text = ` ${dateStr} `;
    const width = 60;
    const leftPad = Math.floor((width - text.length) / 2);
    const rightPad = width - leftPad - text.length;
    return `{grey-fg}${'═'.repeat(leftPad)}${text}${'═'.repeat(rightPad)}{/grey-fg}`;
  }

  private getEmoji(action: string): string {
    switch (action) {
      case 'create':
        return '✨';
      case 'update':
        return '✏️';
      case 'delete':
        return '🗑️';
      case 'error':
        return '❌';
      case 'sync':
        return '🔄';
      default:
        return 'ℹ️';
    }
  }

  private getActionColor(action: string): string {
    switch (action) {
      case 'create':
        return 'green';
      case 'update':
        return 'yellow';
      case 'delete':
        return 'red';
      case 'error':
        return 'red';
      default:
        return 'white';
    }
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'applied':
        return 'green';
      case 'pending':
        return 'yellow';
      case 'failed':
        return 'red';
      default:
        return 'white';
    }
  }

  private startWatching() {
    const logsDir = path.join(this.options.vaultPath, '_logs');

    this.watcher = chokidar.watch(`${logsDir}/events-*.md`, {
      persistent: true,
      ignoreInitial: true,
      usePolling: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    this.watcher.on('change', (filePath) => {
      this.handleFileChange(filePath);
    });

    this.watcher.on('add', (filePath) => {
      this.handleFileChange(filePath);
    });

    this.log.log('{cyan-fg}Watching for new events...{/cyan-fg}');
  }

  private handleFileChange(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lastPos = this.lastPosition.get(filePath) || 0;

      // Only parse new content
      if (content.length > lastPos) {
        const newContent = content.substring(lastPos);
        const newEvents = this.parseLogContent(newContent);

        // Check if user is at the bottom before adding new events
        const wasAtBottom = this.log.getScrollPerc() >= 95;

        // Display new events
        for (const event of newEvents) {
          const formatted = this.formatEvent(event);
          this.log.log(formatted);
          this.log.log('');
          this.eventCount++;
        }

        // Only auto-scroll if user was already at the bottom (Slack/Discord behavior)
        if (wasAtBottom) {
          this.log.setScrollPerc(100);
        }

        this.lastPosition.set(filePath, content.length);
        this.updateStatus();
        this.screen.render();
      }
    } catch (error) {
      // Ignore read errors
    }
  }

  private parseLogContent(content: string): Event[] {
    const events: Event[] = [];
    const sections = content.split(/^## /gm).filter(s => s.trim());

    for (const section of sections) {
      try {
        const parsed = matter(`---\n${section}`);
        const data = parsed.data;

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
          error: data.error
        };

        events.push(event);
      } catch {
        // Skip malformed
      }
    }

    return events;
  }

  private updateStatus() {
    const watchStatus = this.options.watch ? 'Watching' : 'Static';
    const status = ` Events: ${this.eventCount} | ${watchStatus} | q: quit | r: refresh | ↑↓: scroll | PgUp/PgDn: page`;
    this.statusBar.setContent(status);
  }

  private async refresh() {
    this.log.setContent('');
    this.log.log('{cyan-fg}Refreshing...{/cyan-fg}');
    this.screen.render();

    const events = await this.loadEvents();
    this.log.setContent('');
    this.displayEvents(events);
    this.updateStatus();
    this.screen.render();
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
    }
    this.screen.destroy();
  }
}
