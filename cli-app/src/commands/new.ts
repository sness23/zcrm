import { Command, Flags, Args } from '@oclif/core';
import path from 'path';
import fs from 'fs';
import {
  ensureVault,
  writeMarkdown,
  slugify,
  getEntityDir,
  getRelativePath,
} from '../lib/vault.js';
import {
  Kind,
  isValidKind,
  generateId,
  getDirName,
  getTypeName,
  getAllKinds,
} from '../lib/entities.js';
import { gitCommitAndPush } from '../lib/git.js';
import { printSuccess, printWarning } from '../lib/output.js';

export default class New extends Command {
  static description = 'Create a new entity record';

  static examples = [
    '<%= config.bin %> <%= command.id %> account "Acme Corp"',
    '<%= config.bin %> <%= command.id %> contact "Jane Doe" --account acme-corp --email jane@example.com',
    '<%= config.bin %> <%= command.id %> opportunity "2025 Deal" --account acme-corp --amount 50000',
    '<%= config.bin %> <%= command.id %> lead "John Smith" --email john@example.com --company "Tech Inc"',
  ];

  static args = {
    kind: Args.string({
      description: `Entity kind (${getAllKinds().join(', ')})`,
      required: true,
    }),
    name: Args.string({
      description: 'Entity name',
      required: true,
    }),
  };

  static flags = {
    // Relationship flags
    account: Flags.string({ description: 'Related account slug' }),
    contact: Flags.string({ description: 'Related contact slug' }),
    opportunity: Flags.string({ description: 'Related opportunity slug' }),
    quote: Flags.string({ description: 'Related quote slug' }),
    product: Flags.string({ description: 'Related product slug' }),

    // Contact flags
    email: Flags.string({ description: 'Email address' }),
    phone: Flags.string({ description: 'Phone number' }),

    // Lead flags
    company: Flags.string({ description: 'Company name (for leads)' }),

    // Product flags
    price: Flags.string({ description: 'Price (for products)' }),

    // Line item flags
    quantity: Flags.string({ description: 'Quantity (for line items)' }),
    'unit-price': Flags.string({ description: 'Unit price (for line items)' }),
    discount: Flags.string({ description: 'Discount percent (for line items)' }),

    // Event flags
    start: Flags.string({ description: 'Start datetime ISO 8601 (for events)' }),
    end: Flags.string({ description: 'End datetime ISO 8601 (for events)' }),
    duration: Flags.string({ description: 'Duration in minutes (for events)' }),
    location: Flags.string({ description: 'Location or video link (for events)' }),
    'related-to': Flags.string({ description: 'Related entity (for events)' }),
    attendees: Flags.string({ description: 'Comma-separated attendee emails (for events)' }),

    // Order flags
    status: Flags.string({ description: 'Status' }),
    'effective-date': Flags.string({ description: 'Effective date YYYY-MM-DD (for orders)' }),
    amount: Flags.string({ description: 'Amount (for orders)' }),
    'order-number': Flags.string({ description: 'Order number (for orders)' }),

    // Contract flags
    'start-date': Flags.string({ description: 'Start date YYYY-MM-DD (for contracts)' }),
    'end-date': Flags.string({ description: 'End date YYYY-MM-DD (for contracts)' }),
    'contract-term': Flags.string({ description: 'Contract term in months (for contracts)' }),
    'contract-value': Flags.string({ description: 'Total contract value (for contracts)' }),
    'contract-number': Flags.string({ description: 'Contract number (for contracts)' }),

    // Asset flags
    'purchase-date': Flags.string({ description: 'Purchase date YYYY-MM-DD (for assets)' }),
    'install-date': Flags.string({ description: 'Install date YYYY-MM-DD (for assets)' }),
    'serial-number': Flags.string({ description: 'Serial number or license key (for assets)' }),

    // Case flags
    priority: Flags.string({ description: 'Priority: low, medium, high, critical (for cases)' }),
    origin: Flags.string({ description: 'Origin: email, phone, web, chat (for cases)' }),
    'case-number': Flags.string({ description: 'Case number (for cases)' }),

    // Knowledge flags
    'article-type': Flags.string({
      description: 'Article type: faq, how-to, troubleshooting, reference, announcement (for knowledge)',
    }),
    category: Flags.string({ description: 'Article category (for knowledge)' }),
    tags: Flags.string({ description: 'Comma-separated tags (for knowledge)' }),
    published: Flags.boolean({ description: 'Mark article as published (for knowledge)' }),
    'article-number': Flags.string({ description: 'Article number (for knowledge)' }),

    // Git flags
    'no-commit': Flags.boolean({ description: 'Create file but do not commit to git' }),
    'no-push': Flags.boolean({ description: 'Commit but do not push to remote' }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(New);

    const kind = args.kind!.toLowerCase();
    const name = args.name!;

    if (!isValidKind(kind)) {
      this.error(`Unknown kind: ${kind}\nValid kinds: ${getAllKinds().join(', ')}`);
    }

    ensureVault();

    const slug = slugify(name);
    const dir = getEntityDir(getDirName(kind as Kind));
    fs.mkdirSync(dir, { recursive: true });

    const { frontmatter, body } = this.buildEntity(kind as Kind, name, flags);

    // Handle composite slugs for line items
    let filename = `${slug}.md`;
    if (kind === 'line-item' && flags.opportunity && flags.product) {
      filename = `${flags.opportunity}-${flags.product}.md`;
    } else if (kind === 'quote-line' && flags.quote && flags.product) {
      filename = `${flags.quote}-${flags.product}.md`;
    }

    const filePath = writeMarkdown(dir, filename, frontmatter, body);
    printSuccess(`Created ${getRelativePath(filePath)}`);

    // Git commit and push
    const entityType = getTypeName(kind as Kind);
    gitCommitAndPush(filePath, 'Create', entityType, name, {
      noCommit: flags['no-commit'],
      noPush: flags['no-push'],
    });
  }

  private buildEntity(
    kind: Kind,
    name: string,
    flags: any,
  ): { frontmatter: any; body: string } {
    let frontmatter: any = {
      id: generateId(kind),
      type: getTypeName(kind),
      name,
    };
    let body = `# ${name}\n`;

    switch (kind) {
      case 'account':
        frontmatter = {
          ...frontmatter,
          lifecycle_stage: 'prospect',
          created: new Date().toISOString().slice(0, 10),
        };
        break;

      case 'contact':
        if (!flags.account) {
          printWarning('Tip: pass --account <slug> to link contact to account.');
        }
        frontmatter = {
          ...frontmatter,
          first_name: name.split(' ')[0],
          last_name: name.split(' ').slice(1).join(' ') || '',
          email: flags.email || '',
          phone: flags.phone || '',
          account: flags.account ? `[[accounts/${flags.account}]]` : null,
        };
        body += '\n## Notes\n- \n';
        break;

      case 'opportunity':
        frontmatter = {
          ...frontmatter,
          account: flags.account ? `[[accounts/${flags.account}]]` : null,
          stage: 'discovery',
          amount_acv: parseFloat(flags.amount || '0'),
          close_date: new Date().toISOString().slice(0, 10),
          probability: 0.1,
          next_action: 'TBD',
        };
        body += '\n- Key risks:\n';
        break;

      case 'activity':
        frontmatter = {
          ...frontmatter,
          kind: 'note',
          when: new Date().toISOString(),
          summary: '',
          duration_min: 0,
        };
        body += '\n- \n';
        break;

      case 'lead':
        frontmatter = {
          ...frontmatter,
          email: flags.email || '',
          phone: flags.phone || '',
          company: flags.company || '',
          status: 'new',
          rating: 'warm',
        };
        body += '\n## Qualification Notes\n- \n';
        break;

      case 'task':
        frontmatter = {
          ...frontmatter,
          subject: name,
          status: 'not_started',
          priority: 'normal',
          due_date: new Date().toISOString().slice(0, 10),
        };
        body += '\n## Details\n- \n';
        break;

      case 'quote':
        frontmatter = {
          ...frontmatter,
          opportunity: flags.opportunity ? `[[opportunities/${flags.opportunity}]]` : null,
          account: flags.account ? `[[accounts/${flags.account}]]` : null,
          status: 'draft',
          amount: 0,
          valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
        };
        body += '\n## Line Items\n- \n\n## Terms\n- \n';
        break;

      case 'product':
        frontmatter = {
          ...frontmatter,
          price: parseFloat(flags.price || '0'),
          is_active: true,
        };
        body += '\n## Description\n- \n\n## Features\n- \n';
        break;

      case 'campaign':
        frontmatter = {
          ...frontmatter,
          status: 'planned',
          campaign_type: 'email',
          start_date: new Date().toISOString().slice(0, 10),
          budget: 0,
          num_leads: 0,
        };
        body += '\n## Goals\n- \n\n## Strategy\n- \n';
        break;

      case 'line-item': {
        if (!flags.opportunity) {
          this.error('Error: --opportunity <slug> is required for line-item');
        }
        if (!flags.product) {
          this.error('Error: --product <slug> is required for line-item');
        }

        const quantity = parseFloat(flags.quantity || '1');
        const unitPrice = parseFloat(flags['unit-price'] || '0');
        const discountPercent = parseFloat(flags.discount || '0');
        const totalPrice = quantity * unitPrice * (1 - discountPercent / 100);

        frontmatter = {
          id: generateId(kind),
          type: 'OpportunityLineItem',
          opportunity: `[[opportunities/${flags.opportunity}]]`,
          product: `[[products/${flags.product}]]`,
          quantity,
          unit_price: unitPrice,
          discount_percent: discountPercent,
          total_price: totalPrice,
          description: name,
        };
        break;
      }

      case 'quote-line': {
        if (!flags.quote) {
          this.error('Error: --quote <slug> is required for quote-line');
        }
        if (!flags.product) {
          this.error('Error: --product <slug> is required for quote-line');
        }

        const quantity = parseFloat(flags.quantity || '1');
        const unitPrice = parseFloat(flags['unit-price'] || '0');
        const discountPercent = parseFloat(flags.discount || '0');
        const totalPrice = quantity * unitPrice * (1 - discountPercent / 100);

        frontmatter = {
          id: generateId(kind),
          type: 'QuoteLineItem',
          quote: `[[quotes/${flags.quote}]]`,
          product: `[[products/${flags.product}]]`,
          quantity,
          unit_price: unitPrice,
          discount_percent: discountPercent,
          total_price: totalPrice,
          description: name,
        };
        break;
      }

      case 'event': {
        if (!flags.start) {
          this.error('Error: --start <datetime> is required for event (ISO 8601 format)');
        }

        let endDatetime = flags.end;
        if (!endDatetime && flags.duration) {
          const startTime = new Date(flags.start);
          const durationMinutes = parseFloat(flags.duration);
          const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
          endDatetime = endTime.toISOString();
        }

        const attendees = flags.attendees
          ? flags.attendees.split(',').map((email: string) => email.trim())
          : undefined;

        frontmatter = {
          id: generateId(kind),
          type: 'Event',
          subject: name,
          start_datetime: flags.start,
          end_datetime: endDatetime,
          location: flags.location,
          related_to: flags['related-to'] ? `[[${flags['related-to']}]]` : undefined,
          attendees,
          description: '',
        };

        Object.keys(frontmatter).forEach(
          (key) => frontmatter[key] === undefined && delete frontmatter[key],
        );

        body = `# ${name}\n\n## Agenda\n- \n\n## Notes\n- \n`;
        break;
      }

      case 'order': {
        if (!flags.account) {
          this.error('Error: --account <slug> is required for order');
        }

        const effectiveDate = flags['effective-date'] || new Date().toISOString().slice(0, 10);
        const status = flags.status || 'draft';
        const totalAmount = parseFloat(flags.amount || '0');

        frontmatter = {
          id: generateId(kind),
          type: 'Order',
          account: `[[accounts/${flags.account}]]`,
          opportunity: flags.opportunity ? `[[opportunities/${flags.opportunity}]]` : undefined,
          status,
          effective_date: effectiveDate,
          total_amount: totalAmount,
          order_number: flags['order-number'],
          description: '',
        };

        Object.keys(frontmatter).forEach(
          (key) => frontmatter[key] === undefined && delete frontmatter[key],
        );

        body = `# ${name}\n\n## Line Items\n- \n\n## Terms & Conditions\n- \n`;
        break;
      }

      case 'contract': {
        if (!flags.account) {
          this.error('Error: --account <slug> is required for contract');
        }

        const startDate = flags['start-date'] || new Date().toISOString().slice(0, 10);
        const status = flags.status || 'draft';
        const contractTerm = flags['contract-term']
          ? parseInt(flags['contract-term'], 10)
          : undefined;
        const totalValue = flags['contract-value']
          ? parseFloat(flags['contract-value'])
          : undefined;

        let endDate = flags['end-date'];
        if (!endDate && contractTerm) {
          const start = new Date(startDate);
          start.setMonth(start.getMonth() + contractTerm);
          endDate = start.toISOString().slice(0, 10);
        }

        frontmatter = {
          id: generateId(kind),
          type: 'Contract',
          account: `[[accounts/${flags.account}]]`,
          opportunity: flags.opportunity ? `[[opportunities/${flags.opportunity}]]` : undefined,
          status,
          start_date: startDate,
          end_date: endDate,
          contract_term: contractTerm,
          total_value: totalValue,
          contract_number: flags['contract-number'],
          description: '',
        };

        Object.keys(frontmatter).forEach(
          (key) => frontmatter[key] === undefined && delete frontmatter[key],
        );

        body = `# ${name}\n\n## Terms\n- \n\n## Renewal Details\n- \n`;
        break;
      }

      case 'asset': {
        if (!flags.account) {
          this.error('Error: --account <slug> is required for asset');
        }
        if (!flags.product) {
          this.error('Error: --product <slug> is required for asset');
        }

        const status = flags.status || 'purchased';
        const quantity = flags.quantity ? parseInt(flags.quantity, 10) : 1;

        frontmatter = {
          id: generateId(kind),
          type: 'Asset',
          account: `[[accounts/${flags.account}]]`,
          product: `[[products/${flags.product}]]`,
          status,
          purchase_date: flags['purchase-date'],
          install_date: flags['install-date'],
          quantity,
          serial_number: flags['serial-number'],
          description: '',
        };

        Object.keys(frontmatter).forEach(
          (key) => frontmatter[key] === undefined && delete frontmatter[key],
        );

        body = `# ${name}\n\n## Installation Details\n- \n\n## Support & Maintenance\n- \n`;
        break;
      }

      case 'case': {
        const status = flags.status || 'new';
        const priority = flags.priority || 'medium';

        frontmatter = {
          id: generateId(kind),
          type: 'Case',
          subject: name,
          account: flags.account ? `[[accounts/${flags.account}]]` : undefined,
          contact: flags.contact ? `[[contacts/${flags.contact}]]` : undefined,
          status,
          priority,
          case_number: flags['case-number'],
          origin: flags.origin,
          description: '',
        };

        Object.keys(frontmatter).forEach(
          (key) => frontmatter[key] === undefined && delete frontmatter[key],
        );

        body = `# ${name}\n\n## Problem Description\n- \n\n## Resolution Steps\n- \n\n## Resolution\n- \n`;
        break;
      }

      case 'knowledge': {
        const articleType = flags['article-type'] || 'faq';
        const tags = flags.tags ? flags.tags.split(',').map((tag: string) => tag.trim()) : undefined;
        const isPublished = flags.published === true;

        frontmatter = {
          id: generateId(kind),
          type: 'Knowledge',
          title: name,
          article_type: articleType,
          category: flags.category,
          tags,
          is_published: isPublished,
          summary: '',
          article_number: flags['article-number'],
        };

        Object.keys(frontmatter).forEach(
          (key) => frontmatter[key] === undefined && delete frontmatter[key],
        );

        body = `# ${name}\n\n## Overview\n- \n\n## Details\n- \n\n## Related Articles\n- \n`;
        break;
      }
    }

    return { frontmatter, body };
  }
}
