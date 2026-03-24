import { Command } from '@oclif/core';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { ensureVault, getVaultPath, getRelativePath } from '../lib/vault.js';
import { printSuccess, printInfo } from '../lib/output.js';

export default class Init extends Command {
  static description = 'Initialize vault structure and default configuration';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  async run(): Promise<void> {
    this.log('Initializing vault...\n');

    // Create vault directory structure
    ensureVault();
    printSuccess('Created vault directory structure');

    // Create default config if it doesn't exist
    const vaultPath = getVaultPath();
    const cfgPath = path.join(vaultPath, 'settings', 'crm.yaml');

    if (!fs.existsSync(cfgPath)) {
      const cfg = {
        id_strategy: 'ulid',
        default_owner: 'User:admin',
        sync_targets: [],
      };
      fs.writeFileSync(cfgPath, yaml.dump(cfg));
      printSuccess(`Created config: ${getRelativePath(cfgPath)}`);
    } else {
      printInfo(`Config already exists: ${getRelativePath(cfgPath)}`);
    }

    this.log('');
    printSuccess(`Vault ready at ${getRelativePath(vaultPath)}`);
    this.log('');
    this.log('Next steps:');
    this.log('  1. Create entities:');
    this.log('     $ cli-app new account "Acme Corp"');
    this.log('     $ cli-app new contact "Jane Doe" --account acme-corp --email jane@example.com');
    this.log('  2. Validate data:');
    this.log('     $ cli-app validate');
    this.log('  3. Seed demo data:');
    this.log('     $ cli-app seed');
  }
}
