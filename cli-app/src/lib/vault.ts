import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

/**
 * Get the vault path (relative to project root)
 */
export function getVaultPath(): string {
  const root = process.cwd();
  return path.join(root, 'vault');
}

/**
 * Get the project root path
 */
export function getRootPath(): string {
  return process.cwd();
}

/**
 * Ensure vault directory structure exists
 */
export function ensureVault(): void {
  const vaultPath = getVaultPath();
  const dirs = [
    '_schemas',
    '_hooks',
    '_automation/prompts',
    'settings',
    'accounts',
    'contacts',
    'opportunities',
    'activities',
    'leads',
    'tasks',
    'quotes',
    'products',
    'campaigns',
    'line-items',
    'quote-lines',
    'events',
    'orders',
    'contracts',
    'assets',
    'cases',
    'knowledge',
    '_logs',
    '_indexes',
  ];

  for (const dir of dirs) {
    fs.mkdirSync(path.join(vaultPath, dir), { recursive: true });
  }
}

/**
 * Get the directory path for an entity type
 */
export function getEntityDir(entityType: string): string {
  const vaultPath = getVaultPath();
  return path.join(vaultPath, entityType);
}

/**
 * Convert a string to a kebab-case slug
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Write a markdown file with frontmatter and body
 */
export function writeMarkdown(
  dir: string,
  filename: string,
  frontmatter: any,
  body: string,
): string {
  const content = matter.stringify(body.trim() + '\n', frontmatter);
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

/**
 * Read a markdown file and parse frontmatter
 */
export function readMarkdown(filePath: string): {
  data: any;
  content: string;
} {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  return matter(fileContent);
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Get all markdown files in a directory
 */
export function getMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
}

/**
 * Get all entity files by type
 */
export function getEntityFiles(entityType: string): string[] {
  const dir = getEntityDir(entityType);
  return getMarkdownFiles(dir).map((f) => path.join(dir, f));
}

/**
 * Get relative path from project root
 */
export function getRelativePath(fullPath: string): string {
  const root = getRootPath();
  return path.relative(root, fullPath);
}
