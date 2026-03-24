import path from 'path';
import type { AppConfig } from './types/config.js';
import type { Channel, ChannelGroup } from './types/channel.js';
import type { Event } from './types/event.js';
import type { Entity } from './types/entity.js';
import { ConfigManager } from './utils/config.js';
import { ScreenManager } from './ui/screen.js';
import { CommandHandler, type CommandContext } from './commands/index.js';
import { EventManager } from './data/events.js';
import { EntityManager } from './data/entities.js';
import { APIClient } from './data/api.js';
import { FileWatcher } from './data/watcher.js';
import { loadDefaultTheme } from './ui/theme.js';

export class IRCApp {
  private config: AppConfig;
  private configManager: ConfigManager;
  private screen: ScreenManager;
  private commandHandler: CommandHandler;
  private eventManager: EventManager;
  private entityManager: EntityManager;
  private apiClient: APIClient;
  private fileWatcher: FileWatcher;

  private channels: Channel[] = [];
  private channelGroups: ChannelGroup[] = [];
  private currentChannel: Channel;

  constructor() {
    this.configManager = new ConfigManager();
    this.config = this.configManager.get();

    // Load theme
    const theme = this.configManager.loadTheme(this.config.theme) || loadDefaultTheme();

    // Initialize screen
    this.screen = new ScreenManager(this.config, theme);

    // Initialize data managers
    const vaultPath = this.configManager.getVaultPath();
    this.eventManager = new EventManager(vaultPath);
    this.entityManager = new EntityManager(vaultPath);
    this.apiClient = new APIClient(this.config.api_url);
    this.fileWatcher = new FileWatcher(vaultPath);

    // Initialize command handler
    const commandContext: CommandContext = {
      config: this.config,
      onMessage: (msg) => this.showMessage(msg),
      onError: (err) => this.showError(err),
      onSuccess: (msg) => this.showSuccess(msg),
      getApp: () => this
    };
    this.commandHandler = new CommandHandler(commandContext);

    // Create default channel
    this.currentChannel = this.createGeneralChannel();
    this.channels.push(this.currentChannel);

    // Setup input handler
    this.screen.input.onSubmit((input) => {
      this.handleInput(input);
    });
  }

  // Initialize and start application
  async start() {
    try {
      // Load configuration
      await this.configManager.load();

      // Show loading message
      this.screen.statusBar.setStatus('Loading...');
      this.screen.render();

      // Try to connect to API
      const apiConnected = await this.apiClient.checkConnection();
      if (apiConnected) {
        this.screen.statusBar.setConnectionStatus(true, 'API');
      } else {
        this.screen.statusBar.setConnectionStatus(false, 'API (using local logs)');
      }

      // Load events
      const events = await this.eventManager.loadEvents(7);
      this.currentChannel.events = events;
      this.screen.messages.setEvents(events);

      // Load entities
      await this.entityManager.loadEntities();
      this.buildChannelList();

      // Start file watcher
      if (this.config.watch_logs) {
        this.fileWatcher.start((event) => {
          this.handleNewEvent(event);
        });
      }

      // Update status
      this.updateStatus();

      // Render
      this.screen.render();

      // Show welcome message
      this.showMessage('Welcome to Zax CRM IRC! Type /help for commands.');
    } catch (error) {
      this.showError(`Failed to start: ${error}`);
    }
  }

  // Handle user input
  private async handleInput(input: string) {
    const trimmed = input.trim();

    if (!trimmed) {
      return;
    }

    // Check if it's a command
    if (trimmed.startsWith('/')) {
      await this.commandHandler.execute(trimmed);
    } else {
      this.showError('Only commands are supported. Type /help for available commands.');
    }

    this.screen.render();
  }

  // Handle new event from file watcher
  private handleNewEvent(event: Event) {
    // Add to event manager
    this.eventManager.addEvent(event);

    // If it's for current channel, add to display
    if (this.shouldShowEventInChannel(event, this.currentChannel)) {
      this.screen.messages.addEvent(event);
      this.screen.render();
    }

    // Update unread counts
    this.updateUnreadCounts();
  }

  // Check if event should be shown in channel
  private shouldShowEventInChannel(event: Event, channel: Channel): boolean {
    if (channel.name === 'general') {
      return true;
    }

    if (channel.entitySlug) {
      return (
        event.entity_slug === channel.entitySlug ||
        event.entity_id.includes(channel.entitySlug)
      );
    }

    return false;
  }

  // Build channel list from entities
  private buildChannelList() {
    this.channelGroups = [];

    const entityTypes = [
      'account',
      'contact',
      'opportunity',
      'lead',
      'activity',
      'task',
      'quote',
      'product',
      'campaign'
    ] as const;

    for (const type of entityTypes) {
      const entities = this.entityManager.getEntitiesByType(type);
      const channels: Channel[] = entities.map((entity) =>
        this.createEntityChannel(entity)
      );

      if (channels.length > 0) {
        this.channelGroups.push({
          title: type + 's',
          channels,
          collapsed: true
        });
      }
    }

    this.screen.sidebar.setChannels(this.channels, this.channelGroups);
    this.screen.render();
  }

  // Create general channel
  private createGeneralChannel(): Channel {
    return {
      id: 'general',
      name: 'general',
      type: 'system',
      events: [],
      unreadCount: 0,
      isPinned: false,
      isActive: true
    };
  }

  // Create entity channel
  private createEntityChannel(entity: Entity): Channel {
    return {
      id: entity.id,
      name: entity.slug,
      type: 'entity',
      entityType: entity.type,
      entitySlug: entity.slug,
      entityId: entity.id,
      events: [],
      unreadCount: 0,
      isPinned: this.configManager.isPinned(entity.slug),
      isActive: false
    };
  }

  // Update unread counts
  private updateUnreadCounts() {
    // TODO: Implement unread count logic
  }

  // Update status bar
  private updateStatus() {
    const eventCount = this.currentChannel.events.length;
    const lastEvent =
      this.currentChannel.events.length > 0
        ? this.currentChannel.events[0].timestamp
        : undefined;

    this.screen.statusBar.setChannelStatus(
      `#${this.currentChannel.name}`,
      eventCount,
      lastEvent
    );
  }

  // Show message
  private showMessage(message: string) {
    this.screen.statusBar.setStatus(message);
    this.screen.render();
  }

  // Show error
  private showError(error: string) {
    this.screen.statusBar.setError(error);
    this.screen.render();
  }

  // Show success
  private showSuccess(message: string) {
    this.screen.statusBar.setSuccess(message);
    this.screen.render();
  }

  // Command implementations

  async joinChannel(channelName: string) {
    const name = channelName.replace(/^#/, '');

    // Find existing channel
    let channel = this.channels.find((c) => c.name === name);

    if (!channel) {
      // Check if it's an entity
      const allEntities = this.entityManager.getAllEntities();
      const entity = allEntities.find((e) => e.slug === name);

      if (entity) {
        channel = this.createEntityChannel(entity);
        this.channels.push(channel);
      } else {
        this.showError(`Channel not found: ${channelName}`);
        return;
      }
    }

    // Switch to channel
    this.currentChannel.isActive = false;
    this.currentChannel = channel;
    this.currentChannel.isActive = true;

    // Load events for channel
    if (channel.type === 'entity' && channel.entitySlug) {
      const events = this.eventManager.getEventsForEntity(
        channel.entityType!,
        channel.entitySlug
      );
      channel.events = events;
    } else {
      channel.events = this.eventManager.getAllEvents();
    }

    // Update display
    this.screen.messages.setChannel(`#${channel.name}`);
    this.screen.messages.setEvents(channel.events);
    this.updateStatus();
    this.screen.sidebar.render();
    this.showSuccess(`Joined #${channel.name}`);
  }

  async partChannel() {
    if (this.currentChannel.name === 'general') {
      this.showError('Cannot leave #general');
      return;
    }

    await this.joinChannel('general');
  }

  async listChannels(filter?: string) {
    const channels = filter
      ? this.channels.filter((c) => c.name.includes(filter))
      : this.channels;

    const list = channels.map((c) => `#${c.name} (${c.events.length} events)`).join('\n');
    this.showMessage(`Channels:\n${list}`);
  }

  nextChannel() {
    const currentIndex = this.channels.indexOf(this.currentChannel);
    const nextIndex = (currentIndex + 1) % this.channels.length;
    this.joinChannel(this.channels[nextIndex].name);
  }

  prevChannel() {
    const currentIndex = this.channels.indexOf(this.currentChannel);
    const prevIndex = (currentIndex - 1 + this.channels.length) % this.channels.length;
    this.joinChannel(this.channels[prevIndex].name);
  }

  async pinChannel(channelName?: string) {
    const channel = channelName
      ? this.channels.find((c) => c.name === channelName)
      : this.currentChannel;

    if (!channel) {
      this.showError('Channel not found');
      return;
    }

    if (channel.isPinned) {
      channel.isPinned = false;
      this.configManager.unpinChannel(channel.name);
      this.showSuccess(`Unpinned #${channel.name}`);
    } else {
      channel.isPinned = true;
      this.configManager.pinChannel(channel.name);
      this.showSuccess(`Pinned #${channel.name}`);
    }

    await this.configManager.save();
    this.screen.sidebar.render();
  }

  async closeChannel() {
    if (this.currentChannel.name === 'general') {
      this.showError('Cannot close #general');
      return;
    }

    const closedName = this.currentChannel.name;
    this.channels = this.channels.filter((c) => c !== this.currentChannel);
    await this.joinChannel('general');
    this.showSuccess(`Closed #${closedName}`);
  }

  async showInfo(channelName?: string) {
    const channel = channelName
      ? this.channels.find((c) => c.name === channelName)
      : this.currentChannel;

    if (!channel) {
      this.showError('Channel not found');
      return;
    }

    const info = `
Channel: #${channel.name}
Type: ${channel.type}
Events: ${channel.events.length}
Pinned: ${channel.isPinned ? 'Yes' : 'No'}
${channel.entityId ? `Entity ID: ${channel.entityId}` : ''}
`;
    this.showMessage(info);
  }

  async whois(id: string) {
    const entity = this.entityManager.getEntityById(id);
    if (entity) {
      this.showMessage(JSON.stringify(entity, null, 2));
    } else {
      this.showError(`Entity not found: ${id}`);
    }
  }

  async showEvents(count: number) {
    const events = this.currentChannel.events.slice(0, count);
    this.screen.messages.setEvents(events);
    this.showSuccess(`Showing last ${count} events`);
  }

  async showStatus() {
    const apiStatus = this.apiClient.isConnected() ? 'Connected' : 'Disconnected';
    const watchStatus = this.fileWatcher.isWatching() ? 'Active' : 'Inactive';
    const eventCount = this.eventManager.getCount();
    const entityCount = this.entityManager.getAllEntities().length;

    const status = `
API: ${apiStatus}
File Watcher: ${watchStatus}
Events: ${eventCount}
Entities: ${entityCount}
Current Channel: #${this.currentChannel.name}
`;
    this.showMessage(status);
  }

  async showStats() {
    const entityCounts = this.entityManager.getCountByType();
    const stats = Object.entries(entityCounts)
      .map(([type, count]) => `${type}: ${count}`)
      .join('\n');

    this.showMessage(`Entity Statistics:\n${stats}`);
  }

  async search(query: string) {
    const results = this.eventManager.searchEvents(query);
    this.screen.messages.setEvents(results);
    this.showSuccess(`Found ${results.length} results for: ${query}`);
  }

  async find(type: string, name: string) {
    const entities = this.entityManager.searchEntities(name);
    const filtered = entities.filter((e) => e.type === type);

    if (filtered.length === 0) {
      this.showError(`No ${type} found matching: ${name}`);
    } else {
      const list = filtered.map((e) => `${e.name} (${e.slug})`).join('\n');
      this.showMessage(`Found ${filtered.length} ${type}(s):\n${list}`);
    }
  }

  async filter(status: string) {
    const filtered = this.eventManager.filterByStatus(status);
    this.screen.messages.setEvents(filtered);
    this.showSuccess(`Filtered ${filtered.length} events by status: ${status}`);
  }

  async grep(pattern: string) {
    const results = this.currentChannel.events.filter((e) =>
      e.message.includes(pattern)
    );
    this.screen.messages.setEvents(results);
    this.showSuccess(`Found ${results.length} matching events`);
  }

  clear() {
    this.screen.messages.clear();
    this.showSuccess('Messages cleared');
  }

  scroll(lines: number) {
    this.screen.messages.scrollUp(lines);
  }

  scrollToTop() {
    this.screen.messages.scrollToTop();
  }

  scrollToBottom() {
    this.screen.messages.scrollToBottom();
  }

  toggleSidebar() {
    this.screen.sidebar.toggleVisibility();
    this.screen.render();
  }

  async setTheme(themeName: string) {
    const theme = this.configManager.loadTheme(themeName);
    if (theme) {
      this.config.theme = themeName;
      this.screen.getColorManager().setTheme(theme);
      this.showSuccess(`Theme changed to: ${themeName}`);
      await this.configManager.save();
    } else {
      this.showError(`Theme not found: ${themeName}`);
    }
  }

  async refresh() {
    this.showMessage('Refreshing...');
    await this.eventManager.loadEvents(7);
    this.currentChannel.events = this.eventManager.getAllEvents();
    this.screen.messages.setEvents(this.currentChannel.events);
    this.updateStatus();
    this.showSuccess('Refreshed');
  }

  async reconnect() {
    this.showMessage('Reconnecting to API...');
    const connected = await this.apiClient.checkConnection();
    if (connected) {
      this.showSuccess('Connected to API');
    } else {
      this.showError('Failed to connect to API');
    }
  }

  toggleWatch() {
    if (this.fileWatcher.isWatching()) {
      this.fileWatcher.stop();
      this.showSuccess('File watching disabled');
    } else {
      this.fileWatcher.start((event) => this.handleNewEvent(event));
      this.showSuccess('File watching enabled');
    }
  }

  toggleDebug() {
    this.showMessage('Debug mode not implemented yet');
  }

  async showConfig() {
    this.showMessage(JSON.stringify(this.config, null, 2));
  }

  async getConfig(key: string) {
    const value = (this.config as any)[key];
    this.showMessage(`${key}: ${value}`);
  }

  async setConfig(key: string, value: string) {
    (this.config as any)[key] = value;
    await this.configManager.save();
    this.showSuccess(`Config updated: ${key} = ${value}`);
  }

  async exportChannel(format: string) {
    this.showMessage(`Export to ${format} not implemented yet`);
  }

  showHistory() {
    const history = this.screen.input.getHistory();
    this.showMessage('Command History:\n' + history.join('\n'));
  }

  quit() {
    this.fileWatcher.stop();
    this.configManager.save();
    this.screen.exit();
  }
}
