import { format, isToday, isYesterday } from 'date-fns';
import type { Event, ParsedEvent } from '../types/event.js';
import type { AppConfig } from '../types/config.js';
import { ColorManager } from './colors.js';

export class EventFormatter {
  private config: AppConfig;
  private colorManager: ColorManager;

  constructor(config: AppConfig, colorManager: ColorManager) {
    this.config = config;
    this.colorManager = colorManager;
  }

  // Format event for display
  format(event: Event): ParsedEvent {
    const emoji = this.getEmoji(event.action);
    const color = this.colorManager.getActionColor(event.action);

    return {
      ...event,
      formattedTimestamp: this.formatTimestamp(event.timestamp),
      formattedDate: this.formatDate(event.timestamp),
      emoji,
      color
    };
  }

  // Format timestamp
  formatTimestamp(date: Date): string {
    return format(date, this.config.timestamp_format);
  }

  // Format date for dividers
  formatDate(date: Date): string {
    if (isToday(date)) {
      return 'Today';
    }
    if (isYesterday(date)) {
      return 'Yesterday';
    }
    return format(date, this.config.date_format);
  }

  // Get emoji for action
  getEmoji(action: string): string {
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

  // Format event as IRC message
  formatAsMessage(event: ParsedEvent): string {
    const lines: string[] = [];

    // Main line with timestamp, emoji, and message
    const timestamp = this.config.show_timestamps ? `{grey-fg}${event.formattedTimestamp}{/grey-fg} ` : '';
    const statusColor = this.colorManager.getStatusColor(event.status);
    const actionColor = event.color;

    lines.push(
      `${timestamp}{bold}<System>{/bold} {${actionColor}-fg}${event.emoji} ${event.message}{/${actionColor}-fg}`
    );

    // Add details (indented)
    if (event.details) {
      for (const [key, value] of Object.entries(event.details)) {
        if (key === 'id' || key === 'timestamp' || key === 'status' || key === 'action') {
          continue; // Skip meta fields
        }
        lines.push(`         {grey-fg}${key}:{/grey-fg} ${value}`);
      }
    }

    // Add status and ID line
    const statusBadge = `{${statusColor}-fg}[${event.status}]{/${statusColor}-fg}`;
    const idBadge = this.config.show_event_ids && event.id
      ? ` {grey-fg}[${event.id.substring(0, 12)}...]{/grey-fg}`
      : '';

    lines.push(`         ${statusBadge}${idBadge}`);

    return lines.join('\n');
  }

  // Create date divider
  createDateDivider(date: string): string {
    const dividerChar = '═';
    const text = ` ${date} `;
    const width = 50; // Approximate width
    const leftPad = Math.floor((width - text.length) / 2);
    const rightPad = width - leftPad - text.length;

    return `{grey-fg}${dividerChar.repeat(leftPad)}${text}${dividerChar.repeat(rightPad)}{/grey-fg}`;
  }

  // Format channel name for sidebar
  formatChannelName(name: string, unreadCount: number, isActive: boolean): string {
    const countStr = unreadCount > 0 ? ` {yellow-fg}[${unreadCount}]{/yellow-fg}` : '';
    const prefix = name.startsWith('#') ? '' : '#';

    if (isActive) {
      return `{white-bg}{black-fg}{bold}${prefix}${name}{/bold}{/black-fg}{/white-bg}${countStr}`;
    } else {
      return `${prefix}${name}${countStr}`;
    }
  }

  // Format entity type as section header
  formatSectionHeader(title: string, collapsed: boolean): string {
    const icon = collapsed ? '▸' : '▾';
    return `{grey-fg}{bold}${icon} ${title.toUpperCase()}{/bold}{/grey-fg}`;
  }

  // Truncate text to fit width
  truncate(text: string, maxWidth: number): string {
    if (text.length <= maxWidth) {
      return text;
    }
    return text.substring(0, maxWidth - 3) + '...';
  }

  // Word wrap text
  wordWrap(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxWidth) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }
}
