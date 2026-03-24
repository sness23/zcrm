#!/usr/bin/env tsx
/**
 * Inspect transformed SF records to verify field mappings
 */

import * as yaml from 'js-yaml';
import { SFImporter, RecordTransformer } from './sf-import.js';
import * as fs from 'fs';

function loadYaml<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(content) as T;
}

function loadJson<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

async function inspectObject(objectName: string, filePath: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${objectName} - Transformed Record Inspection`);
  console.log('='.repeat(70));

  // Load mappings and data
  const mappings: any = loadYaml('sf/mappings.yaml');
  const data: any = loadJson(filePath);
  const records = data.result?.records || data.records || data;

  const transformer = new RecordTransformer(mappings);
  const objectMapping = mappings.objects[objectName];

  if (!objectMapping) {
    console.error(`No mapping found for ${objectName}`);
    return;
  }

  // Transform first record and show details
  const sfRecord = records[0];
  const { record: fsRecord, body } = transformer.transform(
    sfRecord,
    objectName,
    objectMapping
  );

  console.log(`\n📄 Original SF Record (${sfRecord.Id}):`);
  console.log(JSON.stringify(sfRecord, null, 2));

  console.log(`\n✨ Transformed Zax CRM Record (${fsRecord.id}):`);
  console.log('---');
  console.log(yaml.dump(fsRecord, { lineWidth: -1, noRefs: true }));
  console.log('---');

  if (body) {
    console.log(`\n📝 Markdown Body:`);
    console.log(body);
  }

  // Show field mapping summary
  console.log(`\n📊 Field Mapping Summary:`);
  console.log('  SF Field → Zax CRM Field');
  console.log('  ' + '-'.repeat(50));

  for (const [sfField, mapping] of Object.entries(objectMapping.fields) as any[]) {
    const sfValue = sfRecord[sfField];
    const fsValue = (fsRecord as any)[mapping.target];

    if (sfValue !== null && sfValue !== undefined) {
      const display = typeof fsValue === 'string' && fsValue.length > 40
        ? fsValue.substring(0, 37) + '...'
        : fsValue;

      console.log(`  ${sfField.padEnd(25)} → ${mapping.target.padEnd(25)} = ${display}`);
    }
  }

  // Show relationship fields
  console.log(`\n🔗 Relationship Fields:`);
  const relationshipFields = Object.entries(objectMapping.fields)
    .filter(([_, mapping]: any) => mapping.resolve)
    .map(([sfField, mapping]: any) => ({
      sfField,
      target: mapping.target,
      sfId: (fsRecord as any)[`${mapping.target}_sf_id`],
      link: (fsRecord as any)[mapping.resolve?.link_field || mapping.target],
    }));

  if (relationshipFields.length > 0) {
    for (const field of relationshipFields) {
      console.log(`  ${field.sfField} (${field.sfId}):`);
      console.log(`    → ${field.target}_sf_id: ${field.sfId}`);
      console.log(`    → Link field: ${field.link || '(will be resolved in Pass 2)'}`);
    }
  } else {
    console.log('  (none)');
  }

  // Show summary
  console.log(`\n📈 Summary:`);
  console.log(`  Total SF fields:     ${Object.keys(sfRecord).length}`);
  console.log(`  Mapped FS fields:    ${Object.keys(fsRecord).length}`);
  console.log(`  Relationship fields: ${relationshipFields.length}`);
}

async function main() {
  console.log('SF → Zax CRM Import Inspection');
  console.log('=' .repeat(70));

  await inspectObject('Account', 'sf/test-data/sample-accounts.json');
  await inspectObject('Contact', 'sf/test-data/sample-contacts.json');
  await inspectObject('Opportunity', 'sf/test-data/sample-opportunities.json');

  console.log(`\n${'='.repeat(70)}`);
  console.log('Inspection Complete!');
  console.log('='.repeat(70));
}

main();
