import blessed from 'blessed';
import type { Event, ParsedEvent } from '../types/event.js';
import type { AppConfig } from '../types/config.js';
import { EventFormatter } from '../utils/formatter.js';

export class MessagesWidget {
  box: blessed.Widgets.BoxElement;
  log: blessed.Widgets.Log;
  private config: AppConfig;
  private formatter: EventFormatter;
  private events: ParsedEvent[] = [];
  private currentChannel: string = '#general';

  constructor(
    parent: blessed.Widgets.Screen,
    config: AppConfig,
    formatter: EventFormatter
  ) {
    this.config = config;
    this.formatter = formatter;

    this.box = blessed.box({
      parent,
      left: `${config.sidebar_width}%`,
      top: 0,
      width: `${100 - config.sidebar_width}%`,
      height: '100%-3',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'white'
        }
      },
      label: ` ${this.currentChannel} `,
      tags: true
    });

    this.log = blessed.log({
      parent: this.box,
      top: 0,
      left: 0,
      width: '100%-2',
      height: '100%-2',
      scrollable: true,
      alwaysScroll: this.config.auto_scroll,
      mouse: true,
      keys: true,
      tags: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'grey'
        },
        style: {
          inverse: true
        }
      }
    });
  }

  // Set current channel
  setChannel(channelName: string) {
    this.currentChannel = channelName;
    this.box.setLabel(` ${channelName} `);
  }

  // Set events for current channel
  setEvents(events: Event[]) {
    this.events = events.map(e => this.formatter.format(e));
    this.render();
  }

  // Add new event
  // Add new event
  addEvent(event: Event) {
    const parsed = this.formatter.format(event);
    this.events.push(parsed);

    // Enforce buffer limit
    if (this.events.length > this.config.max_buffer_size) {
      this.events = this.events.slice(-this.config.max_buffer_size);
    }

    // Check if user is at or near the bottom before adding new message
    const scrollHeight = this.log.getScrollHeight();
    const scrollPerc = this.log.getScrollPerc();
    const isAtBottom = scrollPerc >= 95; // Consider "at bottom" if within 5% of the end

    const formatted = this.formatter.formatAsMessage(parsed);
    this.log.log(formatted);

    // Auto-scroll to bottom only if user was already at the bottom
    // This mimics Discord/Slack behavior
    if (isAtBottom) {
      this.log.setScrollPerc(100);
    }
  }

  // Render all events
  // Render all events
  render() {
    // Check if user is at or near the bottom before re-rendering
    const scrollPerc = this.log.getScrollPerc();
    const wasAtBottom = scrollPerc >= 95; // Consider "at bottom" if within 5% of the end

    this.log.setContent('');

    let currentDate = '';

    for (const event of this.events) {
      // Add date divider if date changed
      if (event.formattedDate !== currentDate) {
        currentDate = event.formattedDate;
        const divider = this.formatter.createDateDivider(currentDate);
        this.log.log(divider);
        this.log.log(''); // Empty line
      }

      // Add event message
      const formatted = this.formatter.formatAsMessage(event);
      this.log.log(formatted);
      this.log.log(''); // Empty line between events
    }

    // Auto-scroll to bottom only if user was already at the bottom
    // This mimics Discord/Slack behavior
    if (wasAtBottom) {
      this.log.setScrollPerc(100);
    }
  }

  // Clear messages
  clear() {
    this.events = [];
    this.log.setContent('');
  }

  // Scroll up
  scrollUp(lines: number = 1) {
    this.log.scroll(-lines);
  }

  // Scroll down
  scrollDown(lines: number = 1) {
    this.log.scroll(lines);
  }

  // Scroll to top
  scrollToTop() {
    this.log.setScrollPerc(0);
  }

  // Scroll to bottom
  scrollToBottom() {
    this.log.setScrollPerc(100);
  }

  // Get event count
  getEventCount(): number {
    return this.events.length;
  }
}
