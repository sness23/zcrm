import blessed from 'blessed';
import type { Channel, ChannelGroup } from '../types/channel.js';
import type { AppConfig } from '../types/config.js';
import { EventFormatter } from '../utils/formatter.js';

export class SidebarWidget {
  box: blessed.Widgets.BoxElement;
  private config: AppConfig;
  private formatter: EventFormatter;
  private channels: Channel[] = [];
  private groups: ChannelGroup[] = [];
  private selectedIndex: number = 0;
  private scrollOffset: number = 0;

  constructor(
    parent: blessed.Widgets.Screen,
    config: AppConfig,
    formatter: EventFormatter
  ) {
    this.config = config;
    this.formatter = formatter;

    this.box = blessed.box({
      parent,
      left: 0,
      top: 0,
      width: `${config.sidebar_width}%`,
      height: '100%-2',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'white'
        }
      },
      scrollable: true,
      mouse: true,
      keys: true,
      tags: true,
      label: ' Zax CRM IRC '
    });
  }

  // Set channels and groups
  setChannels(channels: Channel[], groups: ChannelGroup[]) {
    this.channels = channels;
    this.groups = groups;
    this.render();
  }

  // Render sidebar content
  render() {
    let content = '';
    let lineIndex = 0;

    // CHANNELS section
    content += this.formatter.formatSectionHeader('CHANNELS', false) + '\n';
    lineIndex++;

    // General channel (always first)
    const generalChannel = this.channels.find(c => c.name === 'general');
    if (generalChannel) {
      const isActive = lineIndex === this.selectedIndex;
      content +=
        this.formatter.formatChannelName(
          '#' + generalChannel.name,
          generalChannel.unreadCount,
          isActive
        ) + '\n';
      lineIndex++;
    }

    content += '\n';
    lineIndex++;

    // PINNED section
    const pinnedChannels = this.channels.filter(c => c.isPinned && c.name !== 'general');
    if (pinnedChannels.length > 0) {
      content += this.formatter.formatSectionHeader('PINNED', false) + '\n';
      lineIndex++;

      for (const channel of pinnedChannels) {
        const isActive = lineIndex === this.selectedIndex;
        content +=
          this.formatter.formatChannelName(
            channel.name,
            channel.unreadCount,
            isActive
          ) + '\n';
        lineIndex++;
      }

      content += '\n';
      lineIndex++;
    }

    // Entity type groups
    for (const group of this.groups) {
      content += this.formatter.formatSectionHeader(group.title, group.collapsed) + '\n';
      lineIndex++;

      if (!group.collapsed) {
        for (const channel of group.channels) {
          const isActive = lineIndex === this.selectedIndex;
          content +=
            '  ' +
            this.formatter.formatChannelName(
              channel.name,
              channel.unreadCount,
              isActive
            ) + '\n';
          lineIndex++;
        }
      }

      content += '\n';
      lineIndex++;
    }

    this.box.setContent(content);
  }

  // Select next channel
  selectNext() {
    const totalLines = this.getTotalLines();
    if (this.selectedIndex < totalLines - 1) {
      this.selectedIndex++;
      this.render();
    }
  }

  // Select previous channel
  selectPrev() {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
      this.render();
    }
  }

  // Get total number of selectable lines
  private getTotalLines(): number {
    let count = 1; // CHANNELS header
    count += this.channels.filter(c => !c.isPinned || c.name === 'general').length;
    count += 1; // Empty line

    const pinnedChannels = this.channels.filter(c => c.isPinned && c.name !== 'general');
    if (pinnedChannels.length > 0) {
      count += 1; // PINNED header
      count += pinnedChannels.length;
      count += 1; // Empty line
    }

    for (const group of this.groups) {
      count += 1; // Group header
      if (!group.collapsed) {
        count += group.channels.length;
      }
      count += 1; // Empty line
    }

    return count;
  }

  // Get selected channel index
  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  // Set selected channel index
  setSelectedIndex(index: number) {
    this.selectedIndex = index;
    this.render();
  }

  // Toggle sidebar visibility
  toggleVisibility() {
    if (this.box.visible) {
      this.box.hide();
    } else {
      this.box.show();
    }
  }
}
