#!/usr/bin/env node
/**
 * Index vault markdown files to Elasticsearch
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { initializeIndex, indexDocument, checkHealth } from './lib/elasticsearch.js';

const VAULT = path.join(process.cwd(), 'vault');

const ENTITY_DIRS = [
  { dir: 'accounts', type: 'Account' },
  { dir: 'contacts', type: 'Contact' },
  { dir: 'opportunities', type: 'Opportunity' },
  { dir: 'leads', type: 'Lead' },
  { dir: 'activities', type: 'Activity' },
  { dir: 'tasks', type: 'Task' },
  { dir: 'quotes', type: 'Quote' },
  { dir: 'products', type: 'Product' },
  { dir: 'campaigns', type: 'Campaign' },
  { dir: 'events', type: 'Event' },
  { dir: 'orders', type: 'Order' },
  { dir: 'contracts', type: 'Contract' },
  { dir: 'assets', type: 'Asset' },
  { dir: 'cases', type: 'Case' },
  { dir: 'knowledge', type: 'Knowledge' },
];

async function indexVaultToElasticsearch() {
  console.log('🔍 Indexing vault to Elasticsearch...');

  // Check Elasticsearch health
  const health = await checkHealth();
  if (!health) {
    console.error('❌ Elasticsearch is not available. Make sure it\'s running on http://localhost:9200');
    process.exit(1);
  }
  console.log('✓ Elasticsearch is healthy');

  // Initialize index
  await initializeIndex();
  console.log('✓ Index initialized');

  let totalIndexed = 0;

  // Index all entity files
  for (const { dir, type } of ENTITY_DIRS) {
    const dirPath = path.join(VAULT, dir);

    if (!fs.existsSync(dirPath)) {
      console.log(`⊘ Skipping ${dir} (directory not found)`);
      continue;
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data: frontmatter, content: body } = matter(content);

      const id = frontmatter.id || file.replace('.md', '');
      const name = frontmatter.name || frontmatter.title || file.replace('.md', '');

      await indexDocument({
        id,
        type,
        name,
        path: `${dir}/${file}`,
        content: body,
        frontmatter,
      });

      totalIndexed++;
    }

    console.log(`✓ Indexed ${files.length} ${type} records`);
  }

  console.log(`\n✅ Successfully indexed ${totalIndexed} documents to Elasticsearch`);
}

// Run indexing
indexVaultToElasticsearch().catch(error => {
  console.error('Error indexing to Elasticsearch:', error);
  process.exit(1);
});
