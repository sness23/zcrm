import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import type { Event } from '../types/event.js';
import { EventParser } from '../utils/parser.js';

export type WatchCallback = (event: Event) => void;

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private parser: EventParser;
  private vaultPath: string;
  private lastPosition: Map<string, number> = new Map();
  private callbacks: WatchCallback[] = [];

  constructor(vaultPath: string) {
    this.parser = new EventParser();
    this.vaultPath = vaultPath;
  }

  // Start watching log files
  start(callback: WatchCallback) {
    this.callbacks.push(callback);

    const logsDir = path.join(this.vaultPath, '_logs');

    if (!fs.existsSync(logsDir)) {
      console.error(`Logs directory not found: ${logsDir}`);
      return;
    }

    // Watch for changes in log files
    this.watcher = chokidar.watch(`${logsDir}/events-*.md`, {
      persistent: true,
      ignoreInitial: true,
      usePolling: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    // Handle file changes
    this.watcher.on('change', (filePath: string) => {
      this.handleFileChange(filePath);
    });

    // Handle new files
    this.watcher.on('add', (filePath: string) => {
      this.handleFileChange(filePath);
    });

    this.watcher.on('error', (error: Error) => {
      console.error('File watcher error:', error);
    });

    console.log(`Watching for changes in: ${logsDir}`);
  }

  // Stop watching
  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.callbacks = [];
  }

  // Handle file change
  private handleFileChange(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lastPos = this.lastPosition.get(filePath) || 0;

      // Only parse new content
      if (content.length > lastPos) {
        const newContent = content.substring(lastPos);
        const events = this.parser.parseLogContent(newContent);

        // Emit events to all callbacks
        for (const event of events) {
          for (const callback of this.callbacks) {
            callback(event);
          }
        }

        // Update position
        this.lastPosition.set(filePath, content.length);
      }
    } catch (error) {
      console.error(`Failed to handle file change for ${filePath}:`, error);
    }
  }

  // Manually refresh a file
  refresh(filePath: string) {
    this.lastPosition.delete(filePath);
    this.handleFileChange(filePath);
  }

  // Check if watching
  isWatching(): boolean {
    return this.watcher !== null;
  }
}
