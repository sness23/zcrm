#!/usr/bin/env node

/**
 * Simplifies seed-real.ts by removing all optional fields from createEvent calls
 * Only keeps the minimal required fields for each entity type
 */

import fs from 'fs';
import path from 'path';

const REQUIRED_FIELDS = {
  'party': ['id', 'name', 'party_type', 'type'],
  'individual': ['id', 'type', 'name', 'party_id', 'person_name'],
  'researcher-profile': ['id', 'type', 'party_id', 'individual_id'],
  'organization': ['id', 'type', 'party_id', 'business_name'],
};

const seedPath = path.join(process.cwd(), 'scripts', 'seed-real.ts');
let content = fs.readFileSync(seedPath, 'utf8');

// Function to simplify a createEvent call
function simplifyCreateEvent(match, indent, varName, entityType, objectContent) {
  const requiredFields = REQUIRED_FIELDS[entityType];
  if (!requiredFields) {
    // Unknown entity type, don't modify
    return match;
  }

  // Extract all field assignments from the object
  const fieldRegex = /^\s*(\w+):\s*(.+?),?\s*$/gm;
  const fields = [];
  let fieldMatch;

  while ((fieldMatch = fieldRegex.exec(objectContent)) !== null) {
    const [, fieldName, fieldValue] = fieldMatch;
    if (requiredFields.includes(fieldName)) {
      fields.push({ name: fieldName, value: fieldValue.replace(/,$/, '') });
    }
  }

  // Rebuild the simplified object
  const simplifiedFields = fields.map(f => `${f.name}: ${f.value}`).join(',\n    ');

  return `${indent}await createEvent('create', '${entityType}', ${varName}, {\n    ${simplifiedFields}\n  });`;
}

// Pattern to match createEvent calls with multi-line objects
const createEventRegex = /^(\s*)await createEvent\('create', '([^']+)', (\w+), \{([^}]+)\}\);/gm;

let simplified = content.replace(createEventRegex, (match, indent, entityType, varName, objectContent) => {
  return simplifyCreateEvent(match, indent, varName, entityType, objectContent);
});

// Write the simplified content back
fs.writeFileSync(seedPath, simplified, 'utf8');

console.log('✅ Simplified seed-real.ts successfully!');
console.log('📊 Removed all optional fields from createEvent calls');
console.log('🔍 Kept only required fields for each entity type:');
Object.entries(REQUIRED_FIELDS).forEach(([type, fields]) => {
  console.log(`  - ${type}: ${fields.join(', ')}`);
});
