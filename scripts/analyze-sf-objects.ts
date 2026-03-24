#!/usr/bin/env tsx
/**
 * Analyze Salesforce objects from sobjects.json
 * Categorizes objects into: Core CRM, Standard, Custom, Managed Package
 */

import * as fs from 'fs';
import * as path from 'path';

const SF_DUMP_DIR = process.argv[2] || 'sf/sf-dump-20251013-051257';
const SOBJECTS_PATH = path.join(SF_DUMP_DIR, 'out/sobjects.json');

// Core CRM objects we want to import
const CORE_CRM_OBJECTS = new Set([
  'Account',
  'Contact',
  'Lead',
  'Opportunity',
  'Campaign',
  'Case',
  'Task',
  'Event',
  'User',
  'Product2',
  'Pricebook2',
  'PricebookEntry',
  'Quote',
  'Order',
  'OrderItem',
  'Contract',
  'Asset',
]);

// Objects to skip (metadata, system, history, share, feed, etc.)
const SKIP_SUFFIXES = [
  'ChangeEvent',
  'Feed',
  'History',
  'Share',
  'Event',
  'EventStore',
  'EventStream',
  'Metric',
  'View',
  'Info',
  'Detail',
  'Status',
  'Member',
];

const SKIP_PREFIXES = [
  'Apex',
  'Aura',
  'Lightning',
  'Flow',
  'Content',
  'Chatter',
  'Setup',
  'User',
  'Permission',
];

interface SObjectAnalysis {
  name: string;
  category: 'core-crm' | 'standard' | 'custom' | 'managed-package';
  isCustom: boolean;
  managedPackage?: string;
  shouldImport: boolean;
  skipReason?: string;
}

function analyzeSObject(name: string): SObjectAnalysis {
  const analysis: SObjectAnalysis = {
    name,
    category: 'standard',
    isCustom: false,
    shouldImport: false,
  };

  // Check if it's a custom object (ends with __c)
  if (name.endsWith('__c')) {
    analysis.isCustom = true;
    analysis.category = 'custom';

    // Check if it's a managed package object (has __ in the middle)
    const parts = name.split('__');
    if (parts.length === 3 && parts[0].length > 0) {
      analysis.category = 'managed-package';
      analysis.managedPackage = parts[0];
      analysis.shouldImport = false;
      analysis.skipReason = `Managed package: ${parts[0]}`;
      return analysis;
    }

    // It's a custom object (not managed)
    analysis.shouldImport = true;
    return analysis;
  }

  // Check if it's a core CRM object
  if (CORE_CRM_OBJECTS.has(name)) {
    analysis.category = 'core-crm';
    analysis.shouldImport = true;
    return analysis;
  }

  // Check if it should be skipped based on suffix
  for (const suffix of SKIP_SUFFIXES) {
    if (name.endsWith(suffix)) {
      analysis.skipReason = `System object (suffix: ${suffix})`;
      return analysis;
    }
  }

  // Check if it should be skipped based on prefix
  for (const prefix of SKIP_PREFIXES) {
    if (name.startsWith(prefix)) {
      analysis.skipReason = `System object (prefix: ${prefix})`;
      return analysis;
    }
  }

  // Standard Salesforce object, but not core CRM
  analysis.skipReason = 'Non-core standard object';
  return analysis;
}

function main() {
  console.log('Analyzing Salesforce objects...\n');

  // Read sobjects.json
  const data = JSON.parse(fs.readFileSync(SOBJECTS_PATH, 'utf-8'));
  const sObjects: string[] = data.result || [];

  console.log(`Total sObjects found: ${sObjects.length}\n`);

  // Analyze each object
  const analyses: SObjectAnalysis[] = sObjects.map(analyzeSObject);

  // Categorize
  const categories = {
    'core-crm': analyses.filter(a => a.category === 'core-crm'),
    'standard': analyses.filter(a => a.category === 'standard'),
    'custom': analyses.filter(a => a.category === 'custom'),
    'managed-package': analyses.filter(a => a.category === 'managed-package'),
  };

  const toImport = analyses.filter(a => a.shouldImport);

  // Print summary
  console.log('=== SUMMARY ===');
  console.log(`Core CRM Objects:      ${categories['core-crm'].length}`);
  console.log(`Standard Objects:      ${categories['standard'].length}`);
  console.log(`Custom Objects:        ${categories['custom'].length}`);
  console.log(`Managed Package Objs:  ${categories['managed-package'].length}`);
  console.log(`\nObjects to Import:     ${toImport.length}`);
  console.log('');

  // Print core CRM objects
  console.log('=== CORE CRM OBJECTS (TO IMPORT) ===');
  categories['core-crm']
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(obj => {
      console.log(`  ✓ ${obj.name}`);
    });
  console.log('');

  // Print custom objects
  if (categories['custom'].length > 0) {
    console.log('=== CUSTOM OBJECTS (TO IMPORT) ===');
    categories['custom']
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(obj => {
        console.log(`  ✓ ${obj.name}`);
      });
    console.log('');
  }

  // Print managed package summary
  if (categories['managed-package'].length > 0) {
    const packages = new Map<string, number>();
    categories['managed-package'].forEach(obj => {
      const pkg = obj.managedPackage!;
      packages.set(pkg, (packages.get(pkg) || 0) + 1);
    });

    console.log('=== MANAGED PACKAGES (SKIP) ===');
    Array.from(packages.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([pkg, count]) => {
        console.log(`  ${pkg}: ${count} objects`);
      });
    console.log('');
  }

  // Write full analysis to JSON
  const outputPath = path.join(SF_DUMP_DIR, 'out/sobject-analysis.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        summary: {
          total: sObjects.length,
          'core-crm': categories['core-crm'].length,
          standard: categories['standard'].length,
          custom: categories['custom'].length,
          'managed-package': categories['managed-package'].length,
          toImport: toImport.length,
        },
        objects: analyses,
        toImport: toImport.map(a => a.name),
      },
      null,
      2
    )
  );

  console.log(`\nFull analysis written to: ${outputPath}`);
}

main();
