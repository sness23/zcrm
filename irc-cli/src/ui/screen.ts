import blessed from 'blessed';
import type { AppConfig } from '../types/config.js';
import { SidebarWidget } from './sidebar.js';
import { MessagesWidget } from './messages.js';
import { InputWidget } from './input.js';
import { StatusBarWidget } from './statusbar.js';
import { EventFormatter } from '../utils/formatter.js';
import { ColorManager } from '../utils/colors.js';
import { KeyboardManager } from '../utils/keyboard.js';

export class ScreenManager {
  screen: blessed.Widgets.Screen;
  sidebar: SidebarWidget;
  messages: MessagesWidget;
  input: InputWidget;
  statusBar: StatusBarWidget;

  private config: AppConfig;
  private formatter: EventFormatter;
  private colorManager: ColorManager;
  private keyboard: KeyboardManager;

  constructor(config: AppConfig, theme: any) {
    this.config = config;

    // Initialize managers
    this.colorManager = new ColorManager(theme);
    this.formatter = new EventFormatter(config, this.colorManager);
    this.keyboard = new KeyboardManager();

    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Zax CRM IRC',
      fullUnicode: true,
      autoPadding: true,
      warnings: false
    });

    // Create widgets
    this.sidebar = new SidebarWidget(this.screen, config, this.formatter);
    this.messages = new MessagesWidget(this.screen, config, this.formatter);
    this.input = new InputWidget(this.screen);
    this.statusBar = new StatusBarWidget(this.screen, config);

    // Setup key bindings
    this.setupKeyBindings();

    // Initial focus on input
    this.input.focus();
  }

  // Setup keyboard shortcuts
  setupKeyBindings() {
    // Quit
    this.screen.key(['q', 'C-c', 'C-q'], () => {
      this.exit();
    });

    // Focus input
    this.screen.key(['i', 'enter'], () => {
      this.input.focus();
    });

    // Scroll messages
    this.screen.key(['up'], () => {
      // Only scroll messages if not in input mode
      const focused = this.screen.focused;
      if (focused !== this.input.box) {
        this.messages.scrollUp();
      }
    });

    this.screen.key(['down'], () => {
      // Only scroll messages if not in input mode
      const focused = this.screen.focused;
      if (focused !== this.input.box) {
        this.messages.scrollDown();
      }
    });

    this.screen.key(['pageup'], () => {
      this.messages.scrollUp(10);
    });

    this.screen.key(['pagedown'], () => {
      this.messages.scrollDown(10);
    });

    this.screen.key(['home'], () => {
      this.messages.scrollToTop();
    });

    this.screen.key(['end'], () => {
      this.messages.scrollToBottom();
    });

    // Escape to blur input
    this.screen.key(['escape'], () => {
      this.input.box.cancel();
      this.screen.render();
    });
  }

  // Render screen
  render() {
    this.screen.render();
  }

  // Exit application
  exit() {
    this.screen.destroy();
    process.exit(0);
  }

  // Get color manager
  getColorManager(): ColorManager {
    return this.colorManager;
  }

  // Get formatter
  getFormatter(): EventFormatter {
    return this.formatter;
  }

  // Get keyboard manager
  getKeyboard(): KeyboardManager {
    return this.keyboard;
  }
}
