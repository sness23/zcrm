#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Find all concepts.jsonld and schema.jsonld files recursively
function findJsonldFiles(dir, results = { concepts: [], schemas: [] }) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findJsonldFiles(filePath, results);
    } else if (file === 'concepts.jsonld') {
      results.concepts.push(filePath);
    } else if (file === 'schema.jsonld') {
      results.schemas.push(filePath);
    }
  }

  return results;
}

// Read and parse JSON-LD files
function loadJsonldFiles(files) {
  return files.map(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      path: filePath,
      data: JSON.parse(content)
    };
  });
}

// Extract entities from concepts and schemas
function extractEntities() {
  console.log('Finding JSON-LD files...');
  const files = findJsonldFiles('./src');

  console.log(`Found ${files.concepts.length} concepts files and ${files.schemas.length} schema files`);

  const conceptFiles = loadJsonldFiles(files.concepts);
  const schemaFiles = loadJsonldFiles(files.schemas);

  // Build a map of all entities
  const entities = new Map();

  // Process concepts
  console.log('Processing concepts...');
  for (const file of conceptFiles) {
    const data = file.data;
    const subjectArea = path.basename(path.dirname(path.dirname(file.path)));
    const entityGroup = path.basename(path.dirname(file.path));

    if (!data.classConcepts) continue;

    // Process each class
    for (const classConcept of data.classConcepts) {
      const className = classConcept['@id'] || classConcept.name;

      if (!entities.has(className)) {
        entities.set(className, {
          '@id': classConcept['@id'],
          name: classConcept.name,
          '@type': classConcept['@type'],
          description: classConcept.description,
          subClassOf: classConcept.subClassOf,
          subjectArea: subjectArea,
          entityGroup: entityGroup,
          properties: [],
          schema: null
        });
      }
    }

    // Process properties and assign to classes
    if (data.propertyConcepts) {
      for (const propertyConcept of data.propertyConcepts) {
        const propertyId = propertyConcept['@id'];
        const domains = propertyConcept.domain || [];

        for (const domain of domains) {
          if (entities.has(domain)) {
            entities.get(domain).properties.push({
              '@id': propertyId,
              '@type': propertyConcept['@type'],
              range: propertyConcept.range,
              description: propertyConcept.description
            });
          }
        }
      }
    }
  }

  // Process schemas
  console.log('Processing schemas...');
  for (const file of schemaFiles) {
    const data = file.data;

    if (!data.schemas) continue;

    for (const schema of data.schemas) {
      const targetClass = schema.targetClass;

      if (entities.has(targetClass)) {
        entities.get(targetClass).schema = {
          '@id': schema['@id'],
          '@type': schema['@type'],
          targetClass: schema.targetClass,
          properties: schema.properties || []
        };
      }
    }
  }

  return entities;
}

// Main execution
function main() {
  console.log('Extracting entities from CIM...\n');

  const entities = extractEntities();

  // Create output directory
  const outputDir = './json';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\nWriting ${entities.size} entity files to ${outputDir}/...\n`);

  // Write each entity to a separate file
  let count = 0;
  for (const [entityName, entityData] of entities) {
    const filename = `${entityName}.json`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(entityData, null, 2));
    count++;

    if (count % 10 === 0 || count === entities.size) {
      console.log(`Written ${count}/${entities.size} files...`);
    }
  }

  console.log('\nDone! Entity files written to json/ directory');
  console.log(`\nSummary:`);
  console.log(`  Total entities: ${entities.size}`);
  console.log(`  Output directory: ${outputDir}`);

  // Print some examples
  console.log(`\nExample files created:`);
  const examples = Array.from(entities.keys()).slice(0, 5);
  for (const example of examples) {
    console.log(`  - json/${example}.json`);
  }
}

main();
