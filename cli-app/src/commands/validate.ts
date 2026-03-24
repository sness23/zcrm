import { Command } from '@oclif/core';
import { ensureVault } from '../lib/vault.js';
import { validateAll, validatorsExist } from '../lib/validation.js';
import { printSuccess, printError, printWarning, createSpinner } from '../lib/output.js';

export default class Validate extends Command {
  static description = 'Run schema and link validation on all vault entities';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  async run(): Promise<void> {
    ensureVault();

    // Check if validators exist
    const validators = validatorsExist();
    if (!validators.frontmatter || !validators.links) {
      printError('Validators not found in vault/_hooks/');
      if (!validators.frontmatter) {
        printWarning('Missing: validate_frontmatter.mjs');
      }
      if (!validators.links) {
        printWarning('Missing: validate_links.py');
      }
      this.log('\nRun "cli-app init" to set up the vault structure.');
      this.exit(1);
    }

    const spinner = createSpinner('Running validators...');
    spinner.start();

    const result = validateAll();

    spinner.stop();

    if (result.success) {
      printSuccess('All validations passed');
      this.exit(0);
    } else {
      printError('Validation failed');
      this.log('');

      for (const error of result.errors) {
        this.log(error);
      }

      for (const warning of result.warnings) {
        printWarning(warning);
      }

      this.exit(1);
    }
  }
}
