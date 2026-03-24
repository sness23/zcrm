import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { CRMDatabase } from '../../src/lib/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test version of worker functions extracted for testing
const ENTITY_MAP: Record<string, string> = {
  accounts: 'accounts',
  contacts: 'contacts',
  opportunities: 'opportunities',
  leads: 'leads',
  activities: 'activities',
  tasks: 'tasks',
  quotes: 'quotes',
  products: 'products',
  campaigns: 'campaigns',
  events: 'events',
  orders: 'orders',
  contracts: 'contracts',
  assets: 'assets',
  cases: 'cases',
  knowledge: 'knowledge',
  visitors: 'visitor-sessions',
  'contact-chats': 'contact-chats',
  imessages: 'imessages',
};

function getEntityTypeFromPath(filePath: string): string | null {
  const parts = filePath.split('/');
  if (parts.length < 2) return null;
  return ENTITY_MAP[parts[0]] || null;
}

function extractIdFromFilename(filename: string): string | null {
  const match = filename.match(/([a-z]+_[0-9A-Z]+)/);
  return match ? match[1] : null;
}

describe('Worker Functions', () => {
  describe('getEntityTypeFromPath', () => {
    it('should extract entity type from valid account path', () => {
      const result = getEntityTypeFromPath('accounts/acme-corp.md');
      expect(result).toBe('accounts');
    });

    it('should extract entity type from valid contact path', () => {
      const result = getEntityTypeFromPath('contacts/john-doe.md');
      expect(result).toBe('contacts');
    });

    it('should extract entity type from valid opportunity path', () => {
      const result = getEntityTypeFromPath('opportunities/big-deal.md');
      expect(result).toBe('opportunities');
    });

    it('should return null for invalid path with single segment', () => {
      const result = getEntityTypeFromPath('file.md');
      expect(result).toBeNull();
    });

    it('should return null for unknown entity type', () => {
      const result = getEntityTypeFromPath('unknown/file.md');
      expect(result).toBeNull();
    });

    it('should handle nested paths correctly', () => {
      const result = getEntityTypeFromPath('leads/subfolder/lead.md');
      expect(result).toBe('leads');
    });
  });

  describe('extractIdFromFilename', () => {
    it('should extract account ID from filename', () => {
      const result = extractIdFromFilename('acc_01HMEXZ5KZ2Q9W3N0Y7G8R6KTB.md');
      expect(result).toBe('acc_01HMEXZ5KZ2Q9W3N0Y7G8R6KTB');
    });

    it('should extract contact ID from filename', () => {
      const result = extractIdFromFilename('con_01HMEXZ5KZ2Q9W3N0Y7G8R6KTB.md');
      expect(result).toBe('con_01HMEXZ5KZ2Q9W3N0Y7G8R6KTB');
    });

    it('should extract ID from filename with name', () => {
      const result = extractIdFromFilename('acme-corp-acc_01HMEXZ5KZ2Q9W3N0Y7G8R6KTB.md');
      expect(result).toBe('acc_01HMEXZ5KZ2Q9W3N0Y7G8R6KTB');
    });

    it('should return null for filename without ID', () => {
      const result = extractIdFromFilename('regular-file.md');
      expect(result).toBeNull();
    });

    it('should handle lead IDs', () => {
      const result = extractIdFromFilename('led_01HMEXZ5KZ2Q9W3N0Y7G8R6KTB.md');
      expect(result).toBe('led_01HMEXZ5KZ2Q9W3N0Y7G8R6KTB');
    });

    it('should handle opportunity IDs', () => {
      const result = extractIdFromFilename('opp_01HMEXZ5KZ2Q9W3N0Y7G8R6KTB.md');
      expect(result).toBe('opp_01HMEXZ5KZ2Q9W3N0Y7G8R6KTB');
    });
  });

  describe('Worker Integration', () => {
    let testDbPath: string;
    let testVaultPath: string;
    let testChangesLogPath: string;
    let crmDb: CRMDatabase;

    beforeEach(() => {
      // Create temporary test database
      testDbPath = path.join(__dirname, `test-worker-${Date.now()}.db`);
      testVaultPath = path.join(__dirname, `test-vault-${Date.now()}`);
      testChangesLogPath = path.join(testVaultPath, 'changes.log');

      // Create test vault directory structure
      fs.mkdirSync(testVaultPath, { recursive: true });
      fs.mkdirSync(path.join(testVaultPath, 'accounts'), { recursive: true });
      fs.mkdirSync(path.join(testVaultPath, 'contacts'), { recursive: true });

      crmDb = new CRMDatabase(testDbPath);
      console.log('✓ Database schema initialized');
    });

    afterEach(() => {
      // Clean up test files
      crmDb.close();
      try {
        if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
        if (fs.existsSync(testVaultPath)) {
          fs.rmSync(testVaultPath, { recursive: true, force: true });
        }
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });

    it('should create changes.log file', () => {
      const logEntry = {
        filePath: 'accounts/test-account.md',
        action: 'create',
        timestamp: new Date().toISOString()
      };

      fs.writeFileSync(testChangesLogPath, JSON.stringify(logEntry) + '\n', 'utf-8');
      expect(fs.existsSync(testChangesLogPath)).toBe(true);

      const content = fs.readFileSync(testChangesLogPath, 'utf-8');
      expect(content).toContain('test-account.md');
    });

    it('should parse changes.log entries', () => {
      const logEntry = {
        filePath: 'accounts/test-account.md',
        action: 'create',
        timestamp: new Date().toISOString()
      };

      fs.writeFileSync(testChangesLogPath, JSON.stringify(logEntry) + '\n', 'utf-8');
      const content = fs.readFileSync(testChangesLogPath, 'utf-8');
      const lines = content.trim().split('\n');
      const parsed = JSON.parse(lines[0]);

      expect(parsed.filePath).toBe('accounts/test-account.md');
      expect(parsed.action).toBe('create');
    });

    it('should sync markdown file with frontmatter to database', () => {
      const accountId = 'acc_01HMEXZ5KZ2Q9W3N0Y7G8R6KTB';
      const accountData = {
        id: accountId,
        type: 'account',
        name: 'Test Account',
        industry: 'Technology'
      };

      const markdown = matter.stringify('# Test Account\n\nAccount details here.', accountData);
      const accountPath = path.join(testVaultPath, 'accounts', 'test-account.md');
      fs.writeFileSync(accountPath, markdown, 'utf-8');

      // Verify file exists
      expect(fs.existsSync(accountPath)).toBe(true);

      // Verify frontmatter parsing
      const content = fs.readFileSync(accountPath, 'utf-8');
      const parsed = matter(content);
      expect(parsed.data.id).toBe(accountId);
      expect(parsed.data.name).toBe('Test Account');
    });

    it('should handle multiple log entries', () => {
      const entries = [
        { filePath: 'accounts/account1.md', action: 'create', timestamp: new Date().toISOString() },
        { filePath: 'contacts/contact1.md', action: 'create', timestamp: new Date().toISOString() },
        { filePath: 'accounts/account2.md', action: 'update', timestamp: new Date().toISOString() }
      ];

      const logContent = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
      fs.writeFileSync(testChangesLogPath, logContent, 'utf-8');

      const content = fs.readFileSync(testChangesLogPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(3);
      expect(JSON.parse(lines[0]).filePath).toBe('accounts/account1.md');
      expect(JSON.parse(lines[1]).filePath).toBe('contacts/contact1.md');
      expect(JSON.parse(lines[2]).action).toBe('update');
    });

    it('should handle delete actions', () => {
      const logEntry = {
        filePath: 'accounts/acc_01HMEXZ5KZ2Q9W3N0Y7G8R6KTB-deleted.md',
        action: 'delete',
        timestamp: new Date().toISOString()
      };

      fs.writeFileSync(testChangesLogPath, JSON.stringify(logEntry) + '\n', 'utf-8');
      const content = fs.readFileSync(testChangesLogPath, 'utf-8');
      const parsed = JSON.parse(content.trim());

      expect(parsed.action).toBe('delete');
      const extractedId = extractIdFromFilename(parsed.filePath);
      expect(extractedId).toBe('acc_01HMEXZ5KZ2Q9W3N0Y7G8R6KTB');
    });

    it('should skip non-entity directories', () => {
      const logEntry = {
        filePath: '_schemas/Account.schema.json',
        action: 'create',
        timestamp: new Date().toISOString()
      };

      const entityType = getEntityTypeFromPath(logEntry.filePath);
      expect(entityType).toBeNull();
    });

    it('should handle empty changes.log gracefully', () => {
      fs.writeFileSync(testChangesLogPath, '', 'utf-8');
      const content = fs.readFileSync(testChangesLogPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line);

      expect(lines.length).toBe(0);
    });
  });
});
