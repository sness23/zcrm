import chalk from 'chalk';
import ora, { Ora } from 'ora';
import Table from 'cli-table3';

/**
 * Print a success message with checkmark
 */
export function printSuccess(message: string): void {
  console.log(chalk.green('✓'), message);
}

/**
 * Print an error message with X mark
 */
export function printError(message: string): void {
  console.error(chalk.red('✗'), message);
}

/**
 * Print a warning message with warning symbol
 */
export function printWarning(message: string): void {
  console.warn(chalk.yellow('⚠'), message);
}

/**
 * Print an info message with info symbol
 */
export function printInfo(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

/**
 * Print a header with styling
 */
export function printHeader(text: string): void {
  console.log(chalk.bold.cyan(`\n${text}\n${'='.repeat(text.length)}`));
}

/**
 * Print a subheader with styling
 */
export function printSubheader(text: string): void {
  console.log(chalk.bold(`\n${text}`));
}

/**
 * Create a spinner with custom text
 */
export function createSpinner(text?: string): Ora {
  return ora({
    text: text || 'Loading...',
    color: 'cyan',
  });
}

/**
 * Format a table with headers and rows
 */
export function formatTable(
  headers: string[],
  rows: string[][],
  options?: {
    compact?: boolean;
    colors?: boolean;
  },
): string {
  const table = new Table({
    head: options?.colors !== false ? headers.map((h) => chalk.cyan(h)) : headers,
    style: {
      head: [],
      border: options?.colors !== false ? ['gray'] : [],
      compact: options?.compact || false,
    },
  });

  table.push(...rows);
  return table.toString();
}

/**
 * Format a key-value table
 */
export function formatKeyValueTable(data: Record<string, string>): string {
  const table = new Table({
    style: {
      border: ['gray'],
    },
  });

  for (const [key, value] of Object.entries(data)) {
    table.push([chalk.cyan(key), value]);
  }

  return table.toString();
}

/**
 * Print a table
 */
export function printTable(
  headers: string[],
  rows: string[][],
  options?: {
    compact?: boolean;
    colors?: boolean;
  },
): void {
  console.log(formatTable(headers, rows, options));
}

/**
 * Print a key-value table
 */
export function printKeyValueTable(data: Record<string, string>): void {
  console.log(formatKeyValueTable(data));
}

/**
 * Highlight text with color
 */
export const highlight = {
  success: (text: string) => chalk.green(text),
  error: (text: string) => chalk.red(text),
  warning: (text: string) => chalk.yellow(text),
  info: (text: string) => chalk.blue(text),
  primary: (text: string) => chalk.cyan(text),
  secondary: (text: string) => chalk.gray(text),
  bold: (text: string) => chalk.bold(text),
};

/**
 * Format a count with label
 */
export function formatCount(count: number, singular: string, plural?: string): string {
  const label = count === 1 ? singular : plural || `${singular}s`;
  return `${chalk.bold(count.toString())} ${label}`;
}

/**
 * Format a file path with proper coloring
 */
export function formatPath(path: string): string {
  return chalk.dim(path);
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return chalk.gray(d.toISOString());
}

/**
 * Format bytes to human readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Print a divider line
 */
export function printDivider(char = '-', length = 50): void {
  console.log(chalk.gray(char.repeat(length)));
}

/**
 * Format duration in milliseconds to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}
