import { Command, Flags } from '@oclif/core';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { ensureVault, getVaultPath } from '../lib/vault.js';
import { clearAllTables, databaseExists, getDatabasePath } from '../lib/database.js';
import { KIND_DIR } from '../lib/entities.js';
import { printSuccess, printWarning, printHeader, formatCount } from '../lib/output.js';

export default class Clean extends Command {
  static description = 'Clear all data from vault (preserves structure)';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --force',
  ];

  static flags = {
    force: Flags.boolean({
      char: 'f',
      description: 'skip confirmation prompt',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Clean);

    ensureVault();

    // Safety check - require --force or confirmation
    if (!flags.force) {
      printWarning('This will delete all data in vault/');
      this.log('   - All entity records (accounts, contacts, etc.)');
      this.log('   - All event logs');
      this.log('   - Database (crm.db)');
      this.log('   - Change logs');
      this.log('   - Chat messages (channels.db)');
      this.log('');
      this.log('   Structure (_schemas, _hooks, settings) will be preserved.');
      this.log('');

      const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to continue?',
          default: false,
        },
      ]);

      if (!confirm) {
        this.log('Aborted.');
        return;
      }
    }

    printHeader('Cleaning vault data');

    const vaultPath = getVaultPath();
    let fileCount = 0;

    // Clear entity directories
    const entityDirs = Object.values(KIND_DIR);
    for (const dir of entityDirs) {
      const dirPath = path.join(vaultPath, dir);
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.md'));
        for (const file of files) {
          fs.unlinkSync(path.join(dirPath, file));
          fileCount++;
        }
        if (files.length > 0) {
          printSuccess(`Cleared ${formatCount(files.length, 'record')} from ${dir}/`);
        }
      }
    }

    // Clear event logs
    const logsDir = path.join(vaultPath, '_logs');
    if (fs.existsSync(logsDir)) {
      const logFiles = fs.readdirSync(logsDir).filter((f) => f.endsWith('.md'));
      for (const file of logFiles) {
        fs.unlinkSync(path.join(logsDir, file));
      }
      if (logFiles.length > 0) {
        printSuccess(`Cleared ${formatCount(logFiles.length, 'event log file')}`);
      }
    }

    // Clear database tables
    if (databaseExists()) {
      try {
        const cleared = clearAllTables();
        printSuccess(`Cleared database (${formatCount(cleared, 'row')} deleted)`);
      } catch (error: any) {
        printWarning(`Could not clear database: ${error.message}`);
      }
    }

    // Clear change log
    const changeLogPath = path.join(vaultPath, 'changes.log');
    if (fs.existsSync(changeLogPath)) {
      fs.unlinkSync(changeLogPath);
      printSuccess('Deleted change log');
    }

    // Clear indexes
    const indexesDir = path.join(vaultPath, '_indexes');
    if (fs.existsSync(indexesDir)) {
      const indexFiles = fs.readdirSync(indexesDir);
      for (const file of indexFiles) {
        fs.unlinkSync(path.join(indexesDir, file));
      }
      if (indexFiles.length > 0) {
        printSuccess(`Cleared ${formatCount(indexFiles.length, 'index file')}`);
      }
    }

    // Clear channel databases (Slack/Quip messages)
    const channelsDbPath = path.join(vaultPath, '_logs', 'channels.db');
    const channelFiles = [
      channelsDbPath,
      `${channelsDbPath}-wal`,
      `${channelsDbPath}-shm`
    ];
    let channelsDeleted = false;
    for (const file of channelFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        channelsDeleted = true;
      }
    }
    if (channelsDeleted) {
      printSuccess('Cleared channels database (chat messages)');
    }

    this.log('');
    printSuccess(`Vault cleaned! Removed ${formatCount(fileCount, 'entity record')}.`);
    this.log('   Structure preserved: _schemas/, _hooks/, _automation/, settings/');
  }
}
