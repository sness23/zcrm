import blessed from 'blessed';

export type InputSubmitHandler = (input: string) => void;

export class InputWidget {
  box: blessed.Widgets.TextboxElement;
  private submitHandlers: InputSubmitHandler[] = [];
  private history: string[] = [];
  private historyIndex: number = -1;

  constructor(parent: blessed.Widgets.Screen) {
    this.box = blessed.textbox({
      parent,
      bottom: 2,
      left: 0,
      width: '100%',
      height: 1,
      inputOnFocus: true,
      keys: true,
      mouse: true,
      style: {
        fg: 'white',
        bg: 'black'
      }
    });

    // Setup input handling
    this.box.on('submit', (value: string) => {
      this.handleSubmit(value);
    });

    // Handle up/down for history
    this.box.key(['up'], () => {
      this.navigateHistory(-1);
    });

    this.box.key(['down'], () => {
      this.navigateHistory(1);
    });
  }

  // Handle submit
  private handleSubmit(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      return;
    }

    // Add to history
    this.history.push(trimmed);
    this.historyIndex = this.history.length;

    // Notify handlers
    for (const handler of this.submitHandlers) {
      handler(trimmed);
    }

    // Clear input
    this.box.clearValue();
    this.box.focus();
  }

  // Navigate command history
  private navigateHistory(direction: number) {
    if (this.history.length === 0) {
      return;
    }

    this.historyIndex += direction;

    if (this.historyIndex < 0) {
      this.historyIndex = 0;
    } else if (this.historyIndex >= this.history.length) {
      this.historyIndex = this.history.length;
      this.box.clearValue();
      return;
    }

    this.box.setValue(this.history[this.historyIndex]);
  }

  // Register submit handler
  onSubmit(handler: InputSubmitHandler) {
    this.submitHandlers.push(handler);
  }

  // Set input value
  setValue(value: string) {
    this.box.setValue(value);
  }

  // Clear input
  clear() {
    this.box.clearValue();
  }

  // Focus input
  focus() {
    this.box.focus();
  }

  // Get command history
  getHistory(): string[] {
    return [...this.history];
  }

  // Clear history
  clearHistory() {
    this.history = [];
    this.historyIndex = -1;
  }
}
