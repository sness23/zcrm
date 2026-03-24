import type { Theme } from '../types/config.js';

export class ColorManager {
  private theme: Theme;
  private nickColorIndex = 0;

  constructor(theme: Theme) {
    this.theme = theme;
  }

  setTheme(theme: Theme) {
    this.theme = theme;
  }

  getTheme(): Theme {
    return this.theme;
  }

  // Get color for event action
  getActionColor(action: string): string {
    switch (action) {
      case 'create':
        return this.theme.create;
      case 'update':
        return this.theme.update;
      case 'delete':
        return this.theme.delete;
      case 'error':
        return this.theme.error;
      default:
        return this.theme.foreground;
    }
  }

  // Get color for event status
  getStatusColor(status: string): string {
    switch (status) {
      case 'applied':
        return this.theme.success;
      case 'pending':
        return this.theme.pending;
      case 'failed':
        return this.theme.error;
      default:
        return this.theme.foreground;
    }
  }

  // Get rotating color for nicknames/entities
  getNickColor(): string {
    const color = this.theme.nick[this.nickColorIndex % this.theme.nick.length];
    this.nickColorIndex++;
    return color;
  }

  // Reset nick color rotation
  resetNickColors() {
    this.nickColorIndex = 0;
  }

  // Convert blessed color format
  toBlessedColor(color: string): string {
    // If it's a hex color, blessed will handle it
    // If it's a color name or combo like "white on blue", return as is
    return color;
  }
}

export function parseColor(color: string): { fg?: string; bg?: string } {
  if (color.includes(' on ')) {
    const [fg, bg] = color.split(' on ');
    return { fg: fg.trim(), bg: bg.trim() };
  }
  return { fg: color };
}
