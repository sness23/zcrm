import type { AppConfig } from '../types/config.js';

export type CommandFunction = (args: string[]) => Promise<void> | void;

export interface CommandContext {
  config: AppConfig;
  onMessage: (message: string) => void;
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
  getApp: () => any; // Reference to main app
}

export class CommandHandler {
  private commands: Map<string, CommandFunction> = new Map();
  private context: CommandContext;

  constructor(context: CommandContext) {
    this.context = context;
    this.registerCommands();
  }

  // Execute a command
  async execute(input: string): Promise<boolean> {
    if (!input.startsWith('/')) {
      return false;
    }

    const [cmd, ...args] = input.slice(1).split(' ').filter(s => s.trim());

    if (!cmd) {
      return false;
    }

    // Check for alias
    const resolved = this.context.config.aliases[cmd] || cmd;
    const handler = this.commands.get(resolved.toLowerCase());

    if (handler) {
      try {
        await handler(args);
        return true;
      } catch (error) {
        this.context.onError(`Command failed: ${error}`);
        return false;
      }
    }

    this.context.onError(`Unknown command: ${cmd}`);
    return false;
  }

  // Register a command
  register(name: string, handler: CommandFunction) {
    this.commands.set(name.toLowerCase(), handler);
  }

  // Register all commands
  private registerCommands() {
    // This will be filled by importing command modules
    // For now, we'll register basic commands

    // Navigation commands
    this.register('join', this.handleJoin.bind(this));
    this.register('part', this.handlePart.bind(this));
    this.register('list', this.handleList.bind(this));
    this.register('next', this.handleNext.bind(this));
    this.register('n', this.handleNext.bind(this));
    this.register('prev', this.handlePrev.bind(this));
    this.register('p', this.handlePrev.bind(this));
    this.register('pin', this.handlePin.bind(this));
    this.register('close', this.handleClose.bind(this));

    // Information commands
    this.register('info', this.handleInfo.bind(this));
    this.register('whois', this.handleWhois.bind(this));
    this.register('events', this.handleEvents.bind(this));
    this.register('status', this.handleStatus.bind(this));
    this.register('stats', this.handleStats.bind(this));

    // Search commands
    this.register('search', this.handleSearch.bind(this));
    this.register('find', this.handleFind.bind(this));
    this.register('filter', this.handleFilter.bind(this));
    this.register('grep', this.handleGrep.bind(this));

    // Display commands
    this.register('clear', this.handleClear.bind(this));
    this.register('scroll', this.handleScroll.bind(this));
    this.register('top', this.handleTop.bind(this));
    this.register('bottom', this.handleBottom.bind(this));
    this.register('expand', this.handleExpand.bind(this));
    this.register('theme', this.handleTheme.bind(this));

    // System commands
    this.register('refresh', this.handleRefresh.bind(this));
    this.register('reconnect', this.handleReconnect.bind(this));
    this.register('watch', this.handleWatch.bind(this));
    this.register('debug', this.handleDebug.bind(this));
    this.register('config', this.handleConfig.bind(this));
    this.register('export', this.handleExport.bind(this));

    // Utility commands
    this.register('help', this.handleHelp.bind(this));
    this.register('version', this.handleVersion.bind(this));
    this.register('quit', this.handleQuit.bind(this));
    this.register('q', this.handleQuit.bind(this));
    this.register('exit', this.handleQuit.bind(this));
    this.register('alias', this.handleAlias.bind(this));
    this.register('history', this.handleHistory.bind(this));
  }

  // Command handlers (stubs for now, will be implemented)
  private async handleJoin(args: string[]) {
    const app = this.context.getApp();
    const channel = args[0];
    if (!channel) {
      this.context.onError('Usage: /join <channel>');
      return;
    }
    await app.joinChannel(channel);
  }

  private async handlePart(args: string[]) {
    const app = this.context.getApp();
    await app.partChannel();
  }

  private async handleList(args: string[]) {
    const app = this.context.getApp();
    await app.listChannels(args[0]);
  }

  private async handleNext(args: string[]) {
    const app = this.context.getApp();
    app.nextChannel();
  }

  private async handlePrev(args: string[]) {
    const app = this.context.getApp();
    app.prevChannel();
  }

  private async handlePin(args: string[]) {
    const app = this.context.getApp();
    await app.pinChannel(args[0]);
  }

  private async handleClose(args: string[]) {
    const app = this.context.getApp();
    await app.closeChannel();
  }

  private async handleInfo(args: string[]) {
    const app = this.context.getApp();
    await app.showInfo(args[0]);
  }

  private async handleWhois(args: string[]) {
    const app = this.context.getApp();
    const id = args[0];
    if (!id) {
      this.context.onError('Usage: /whois <id>');
      return;
    }
    await app.whois(id);
  }

  private async handleEvents(args: string[]) {
    const app = this.context.getApp();
    const count = parseInt(args[0]) || 20;
    await app.showEvents(count);
  }

  private async handleStatus(args: string[]) {
    const app = this.context.getApp();
    await app.showStatus();
  }

  private async handleStats(args: string[]) {
    const app = this.context.getApp();
    await app.showStats();
  }

  private async handleSearch(args: string[]) {
    const app = this.context.getApp();
    const query = args.join(' ');
    if (!query) {
      this.context.onError('Usage: /search <query>');
      return;
    }
    await app.search(query);
  }

  private async handleFind(args: string[]) {
    const app = this.context.getApp();
    if (args.length < 2) {
      this.context.onError('Usage: /find <type> <name>');
      return;
    }
    await app.find(args[0], args.slice(1).join(' '));
  }

  private async handleFilter(args: string[]) {
    const app = this.context.getApp();
    const status = args[0];
    if (!status) {
      this.context.onError('Usage: /filter <status>');
      return;
    }
    await app.filter(status);
  }

  private async handleGrep(args: string[]) {
    const app = this.context.getApp();
    const pattern = args.join(' ');
    if (!pattern) {
      this.context.onError('Usage: /grep <pattern>');
      return;
    }
    await app.grep(pattern);
  }

  private async handleClear(args: string[]) {
    const app = this.context.getApp();
    app.clear();
  }

  private async handleScroll(args: string[]) {
    const app = this.context.getApp();
    const lines = parseInt(args[0]) || 10;
    app.scroll(lines);
  }

  private async handleTop(args: string[]) {
    const app = this.context.getApp();
    app.scrollToTop();
  }

  private async handleBottom(args: string[]) {
    const app = this.context.getApp();
    app.scrollToBottom();
  }

  private async handleExpand(args: string[]) {
    const app = this.context.getApp();
    app.toggleSidebar();
  }

  private async handleTheme(args: string[]) {
    const app = this.context.getApp();
    const theme = args[0];
    if (!theme) {
      this.context.onError('Usage: /theme <name>');
      return;
    }
    await app.setTheme(theme);
  }

  private async handleRefresh(args: string[]) {
    const app = this.context.getApp();
    await app.refresh();
  }

  private async handleReconnect(args: string[]) {
    const app = this.context.getApp();
    await app.reconnect();
  }

  private async handleWatch(args: string[]) {
    const app = this.context.getApp();
    app.toggleWatch();
  }

  private async handleDebug(args: string[]) {
    const app = this.context.getApp();
    app.toggleDebug();
  }

  private async handleConfig(args: string[]) {
    const app = this.context.getApp();
    if (args.length === 0) {
      await app.showConfig();
    } else if (args.length === 1) {
      await app.getConfig(args[0]);
    } else {
      await app.setConfig(args[0], args.slice(1).join(' '));
    }
  }

  private async handleExport(args: string[]) {
    const app = this.context.getApp();
    const format = args[0] || 'json';
    await app.exportChannel(format);
  }

  private async handleHelp(args: string[]) {
    const command = args[0];
    if (command) {
      this.showCommandHelp(command);
    } else {
      this.showGeneralHelp();
    }
  }

  private async handleVersion(args: string[]) {
    this.context.onMessage('Zax CRM IRC v1.0.0');
  }

  private async handleQuit(args: string[]) {
    const app = this.context.getApp();
    app.quit();
  }

  private async handleAlias(args: string[]) {
    if (args.length < 2) {
      this.context.onError('Usage: /alias <name> <command>');
      return;
    }
    this.context.config.aliases[args[0]] = args.slice(1).join(' ');
    this.context.onSuccess(`Alias created: ${args[0]} → ${args.slice(1).join(' ')}`);
  }

  private async handleHistory(args: string[]) {
    const app = this.context.getApp();
    app.showHistory();
  }

  // Help text
  private showGeneralHelp() {
    const help = `
Zax CRM IRC Commands

Navigation:
  /join <channel>    Switch to channel
  /part              Leave current channel
  /list [filter]     List all channels
  /next, /n          Switch to next channel
  /prev, /p          Switch to previous channel
  /pin [channel]     Pin/unpin channel
  /close             Close current channel

Information:
  /info [channel]    Show channel info
  /whois <id>        Show entity details
  /events [n]        Show last n events
  /status            Show system status
  /stats             Show statistics

Search:
  /search <query>    Full-text search
  /find <type> <name> Find entity
  /filter <status>   Filter by status
  /grep <pattern>    Grep current channel

Display:
  /clear             Clear messages
  /scroll <n>        Scroll up n lines
  /top               Jump to top
  /bottom            Jump to bottom
  /expand            Toggle sidebar
  /theme <name>      Switch theme

System:
  /refresh           Refresh from logs
  /reconnect         Reconnect to API
  /watch             Toggle file watching
  /config [key] [val] Get/set config
  /help [command]    Show help
  /quit, /q          Exit application

Shortcuts:
  Alt+1-9            Switch to pinned channels
  Ctrl+N/P           Next/previous channel
  Ctrl+R             Refresh
  Ctrl+F             Search
  Ctrl+L             Clear
`;
    this.context.onMessage(help);
  }

  private showCommandHelp(command: string) {
    // TODO: Add detailed help for specific commands
    this.context.onMessage(`Help for: ${command}`);
  }
}
