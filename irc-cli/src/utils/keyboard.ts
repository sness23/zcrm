import type blessed from 'blessed';

export type KeyHandler = (ch: any, key: any) => void;

export class KeyboardManager {
  private handlers: Map<string, KeyHandler> = new Map();

  // Register a key handler
  on(keyCombo: string, handler: KeyHandler) {
    this.handlers.set(keyCombo, handler);
  }

  // Remove a key handler
  off(keyCombo: string) {
    this.handlers.delete(keyCombo);
  }

  // Get handler for key combination
  getHandler(keyCombo: string): KeyHandler | undefined {
    return this.handlers.get(keyCombo);
  }

  // Attach to blessed screen
  attach(screen: blessed.Widgets.Screen) {
    screen.on('keypress', (ch: any, key: any) => {
      const combo = this.getKeyCombo(key);
      const handler = this.handlers.get(combo);

      if (handler) {
        handler(ch, key);
      }
    });
  }

  // Get key combination string
  private getKeyCombo(key: any): string {
    if (!key) return '';

    const parts: string[] = [];

    if (key.ctrl) parts.push('C');
    if (key.meta) parts.push('M');
    if (key.shift && key.name.length > 1) parts.push('S');

    parts.push(key.name);

    return parts.join('-');
  }

  // Setup default IRC-style keybindings
  setupDefaultBindings(handlers: {
    onQuit: () => void;
    onNextChannel: () => void;
    onPrevChannel: () => void;
    onRefresh: () => void;
    onHelp: () => void;
    onSearch: () => void;
    onInfo: () => void;
    onClear: () => void;
    onToggleTimestamps: () => void;
    onToggleEventIds: () => void;
    onSwitchToChannel: (n: number) => void;
  }) {
    // Quit
    this.on('C-q', handlers.onQuit);
    this.on('C-d', handlers.onQuit);
    this.on('C-c', handlers.onQuit);

    // Navigation
    this.on('C-n', handlers.onNextChannel);
    this.on('C-p', handlers.onPrevChannel);
    this.on('M-down', handlers.onNextChannel);
    this.on('M-up', handlers.onPrevChannel);

    // Actions
    this.on('C-r', handlers.onRefresh);
    this.on('f1', handlers.onHelp);
    this.on('f5', handlers.onRefresh);
    this.on('C-f', handlers.onSearch);
    this.on('C-i', handlers.onInfo);
    this.on('C-l', handlers.onClear);
    this.on('C-t', handlers.onToggleTimestamps);
    this.on('C-e', handlers.onToggleEventIds);

    // Channel switching (Alt+1-9)
    for (let i = 1; i <= 9; i++) {
      this.on(`M-${i}`, () => handlers.onSwitchToChannel(i - 1));
    }
  }
}

// Key constants
export const Keys = {
  QUIT: ['C-q', 'C-d', 'C-c'],
  NEXT: ['C-n', 'M-down'],
  PREV: ['C-p', 'M-up'],
  REFRESH: ['C-r', 'f5'],
  HELP: ['f1'],
  SEARCH: ['C-f'],
  INFO: ['C-i'],
  CLEAR: ['C-l'],
  TOGGLE_TIMESTAMPS: ['C-t'],
  TOGGLE_EVENT_IDS: ['C-e']
};
