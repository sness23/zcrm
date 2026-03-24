import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import type { AppConfig, Theme } from '../types/config.js';
import { DEFAULT_CONFIG } from '../types/config.js';

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;
  private themesDir: string;

  constructor() {
    // Default paths
    const configDir = path.join(os.homedir(), '.config', 'fscrm-irc');
    this.configPath = path.join(configDir, 'config.yaml');
    this.themesDir = path.join(process.cwd(), 'themes');

    this.config = { ...DEFAULT_CONFIG };
  }

  // Load config from file or create default
  async load(): Promise<AppConfig> {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = yaml.load(content) as Partial<AppConfig>;
        this.config = { ...DEFAULT_CONFIG, ...loaded };
      } else {
        // Create default config
        await this.save();
      }
    } catch (error) {
      console.error('Failed to load config, using defaults:', error);
    }
    return this.config;
  }

  // Save config to file
  async save(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const content = yaml.dump(this.config, {
        indent: 2,
        lineWidth: -1
      });
      fs.writeFileSync(this.configPath, content, 'utf-8');
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  // Get config
  get(): AppConfig {
    return this.config;
  }

  // Set config value
  set(key: keyof AppConfig, value: any): void {
    (this.config as any)[key] = value;
  }

  // Load theme
  loadTheme(themeName: string): Theme | null {
    try {
      const themePath = path.join(this.themesDir, `${themeName}.json`);
      if (!fs.existsSync(themePath)) {
        console.error(`Theme not found: ${themeName}`);
        return null;
      }

      const content = fs.readFileSync(themePath, 'utf-8');
      const theme = JSON.parse(content) as Theme;
      return theme;
    } catch (error) {
      console.error('Failed to load theme:', error);
      return null;
    }
  }

  // List available themes
  listThemes(): string[] {
    try {
      if (!fs.existsSync(this.themesDir)) {
        return ['default'];
      }

      const files = fs.readdirSync(this.themesDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch (error) {
      console.error('Failed to list themes:', error);
      return ['default'];
    }
  }

  // Add pinned channel
  pinChannel(channel: string): void {
    if (!this.config.pinned.includes(channel)) {
      this.config.pinned.push(channel);
    }
  }

  // Remove pinned channel
  unpinChannel(channel: string): void {
    this.config.pinned = this.config.pinned.filter(c => c !== channel);
  }

  // Check if channel is pinned
  isPinned(channel: string): boolean {
    return this.config.pinned.includes(channel);
  }

  // Add alias
  addAlias(name: string, command: string): void {
    this.config.aliases[name] = command;
  }

  // Get alias
  getAlias(name: string): string | undefined {
    return this.config.aliases[name];
  }

  // Resolve vault path
  getVaultPath(): string {
    if (path.isAbsolute(this.config.vault_path)) {
      return this.config.vault_path;
    }
    return path.resolve(process.cwd(), this.config.vault_path);
  }
}
