import blessed from 'blessed';
import type { AppConfig } from '../types/config.js';

export class StatusBarWidget {
  box: blessed.Widgets.BoxElement;
  helpBox: blessed.Widgets.BoxElement;
  private config: AppConfig;

  constructor(parent: blessed.Widgets.Screen, config: AppConfig) {
    this.config = config;

    // Status info line
    this.box = blessed.box({
      parent,
      bottom: 1,
      left: 0,
      width: '100%',
      height: 1,
      tags: true,
      style: {
        fg: 'black',
        bg: 'white'
      }
    });

    // Help/commands line
    this.helpBox = blessed.box({
      parent,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      tags: true,
      style: {
        fg: 'grey',
        bg: 'black'
      }
    });

    this.setDefaultHelp();
  }

  // Set status message
  setStatus(message: string) {
    this.box.setContent(` ${message}`);
  }

  // Set status with channel info
  setChannelStatus(channelName: string, eventCount: number, lastUpdate?: Date) {
    const updateStr = lastUpdate
      ? `Last update: ${lastUpdate.toLocaleTimeString()}`
      : 'No updates';

    const message = `[${channelName}] ${eventCount} events | ${updateStr}`;
    this.setStatus(message);
  }

  // Set error message
  setError(message: string) {
    this.box.setContent(` {red-fg}ERROR:{/red-fg} ${message}`);
  }

  // Set success message
  setSuccess(message: string) {
    this.box.setContent(` {green-fg}✓{/green-fg} ${message}`);
  }

  // Set help text
  setHelp(text: string) {
    this.helpBox.setContent(` ${text}`);
  }

  // Set default help text
  setDefaultHelp() {
    const shortcuts = [
      '/join <channel>',
      '/list',
      '/info',
      '/search <query>',
      '/help',
      'Alt+1-9: switch'
    ];
    this.helpBox.setContent(` ${shortcuts.join(' | ')}`);
  }

  // Clear help text
  clearHelp() {
    this.helpBox.setContent('');
  }

  // Show connection status
  setConnectionStatus(connected: boolean, source: string) {
    const icon = connected ? '{green-fg}●{/green-fg}' : '{red-fg}●{/red-fg}';
    const status = connected ? 'Connected' : 'Disconnected';
    this.box.setContent(` ${icon} ${status} to ${source}`);
  }
}
