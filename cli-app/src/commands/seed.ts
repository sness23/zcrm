import { Command, Flags } from '@oclif/core';
import { ensureVault } from '../lib/vault.js';
import { seedEntities } from '../lib/seeder.js';
import { Kind, getAllKinds } from '../lib/entities.js';
import {
  printSuccess,
  printHeader,
  formatCount,
  createSpinner,
} from '../lib/output.js';

export default class Seed extends Command {
  static description = 'Seed vault with demo data';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --count 20',
    '<%= config.bin %> <%= command.id %> --type account',
    '<%= config.bin %> <%= command.id %> --dry-run',
  ];

  static flags = {
    count: Flags.integer({
      char: 'c',
      description: 'Number of records to create per entity type',
      default: 10,
    }),
    type: Flags.string({
      char: 't',
      description: 'Seed only a specific entity type',
      options: getAllKinds(),
    }),
    'dry-run': Flags.boolean({
      description: 'Show what would be created without actually creating files',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Seed);

    ensureVault();

    printHeader('Seeding vault with demo data');

    const typesToSeed: Kind[] = flags.type
      ? [flags.type as Kind]
      : ['account', 'contact', 'opportunity', 'lead', 'product'];

    let totalCreated = 0;

    for (const kind of typesToSeed) {
      const spinner = createSpinner(`Creating ${kind}s...`);
      if (!flags['dry-run']) {
        spinner.start();
      }

      const results = seedEntities(kind, {
        count: flags.count,
        dryRun: flags['dry-run'],
        verbose: false,
      });

      if (!flags['dry-run']) {
        spinner.stop();
      }

      printSuccess(
        `Created ${formatCount(results.length, kind)} ${flags['dry-run'] ? '(dry run)' : ''}`,
      );
      totalCreated += results.length;
    }

    this.log('');
    printSuccess(
      `Seeding complete! ${formatCount(totalCreated, 'record')} ${flags['dry-run'] ? 'would be ' : ''}created.`,
    );

    if (!flags['dry-run']) {
      this.log('');
      this.log('Next steps:');
      this.log('  $ cli-app validate    # Validate the seeded data');
    }
  }
}
