import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Scholar API Endpoints', () => {
  const API_URL = 'http://localhost:9600';
  const TEST_PARTY_ID = 'pty_test_scholar_123';
  const TEST_SCHOLAR_ID = 'TestScholarId123';

  beforeAll(() => {
    // Setup: Create a test scholar file in scholarmd
    const scholarDir = path.join(process.cwd(), 'vault', 'scholarmd', 'scholars');
    if (!fs.existsSync(scholarDir)) {
      fs.mkdirSync(scholarDir, { recursive: true });
    }

    const scholarFile = path.join(scholarDir, `${TEST_SCHOLAR_ID.toLowerCase()}.md`);
    const scholarContent = `---
author_id: ${TEST_SCHOLAR_ID}
name: Test Scholar
affiliations: Test University
h_index: 42
total_citations: 5000
total_articles: 100
scholar_url: https://scholar.google.com/citations?user=${TEST_SCHOLAR_ID}
tags:
  - test
  - researcher
---

# Test Scholar

## Publications

- Publication 1
- Publication 2

## Research Interests

- Machine Learning
- Data Science
`;

    fs.writeFileSync(scholarFile, scholarContent, 'utf-8');

    // Create party identification
    const idsDir = path.join(process.cwd(), 'vault', 'party-identifications');
    if (!fs.existsSync(idsDir)) {
      fs.mkdirSync(idsDir, { recursive: true });
    }

    const idFile = path.join(idsDir, `test-scholar-${TEST_SCHOLAR_ID}.md`);
    const idContent = `---
id: pid_test_${TEST_SCHOLAR_ID}
type: party-identification
party_id: ${TEST_PARTY_ID}
identification_number: ${TEST_SCHOLAR_ID}
party_identification_type: GoogleScholar
---
# Test Scholar ID
`;

    fs.writeFileSync(idFile, idContent, 'utf-8');
  });

  afterAll(() => {
    // Cleanup: Remove test files
    try {
      const scholarFile = path.join(
        process.cwd(),
        'vault',
        'scholarmd',
        'scholars',
        `${TEST_SCHOLAR_ID.toLowerCase()}.md`
      );
      if (fs.existsSync(scholarFile)) {
        fs.unlinkSync(scholarFile);
      }

      const idFile = path.join(
        process.cwd(),
        'vault',
        'party-identifications',
        `test-scholar-${TEST_SCHOLAR_ID}.md`
      );
      if (fs.existsSync(idFile)) {
        fs.unlinkSync(idFile);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  it('should fetch scholar file for a party with Google Scholar ID', async () => {
    const response = await fetch(`${API_URL}/api/researchers/${TEST_PARTY_ID}/scholar-file`);

    expect(response.ok).toBe(true);

    const data = await response.json();

    expect(data).toHaveProperty('scholar_id', TEST_SCHOLAR_ID);
    expect(data).toHaveProperty('frontmatter');
    expect(data).toHaveProperty('body');
    expect(data.frontmatter).toHaveProperty('name', 'Test Scholar');
    expect(data.frontmatter).toHaveProperty('h_index', 42);
    expect(data.frontmatter).toHaveProperty('total_citations', 5000);
    expect(data.body).toContain('Publications');
    expect(data.body).toContain('Research Interests');
  });

  it('should return 404 for party without Google Scholar ID', async () => {
    const response = await fetch(`${API_URL}/api/researchers/pty_nonexistent_123/scholar-file`);

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Google Scholar ID');
  });

  it('should return 404 for party with non-existent scholar file', async () => {
    // Create a party identification with a non-existent scholar ID
    const idsDir = path.join(process.cwd(), 'vault', 'party-identifications');
    const tempIdFile = path.join(idsDir, 'temp-nonexistent-scholar.md');
    const tempContent = `---
id: pid_temp_nonexistent
type: party-identification
party_id: pty_temp_nonexistent
identification_number: NonExistentScholarId
party_identification_type: GoogleScholar
---
# Temp ID
`;

    fs.writeFileSync(tempIdFile, tempContent, 'utf-8');

    try {
      const response = await fetch(`${API_URL}/api/researchers/pty_temp_nonexistent/scholar-file`);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Scholar file not found');
      expect(data).toHaveProperty('scholar_id', 'NonExistentScholarId');
    } finally {
      // Cleanup
      if (fs.existsSync(tempIdFile)) {
        fs.unlinkSync(tempIdFile);
      }
    }
  });

  it('should validate scholar ID format and reject invalid characters', async () => {
    const idsDir = path.join(process.cwd(), 'vault', 'party-identifications');
    const tempIdFile = path.join(idsDir, 'temp-invalid-scholar.md');
    const tempContent = `---
id: pid_temp_invalid
type: party-identification
party_id: pty_temp_invalid
identification_number: ../../../etc/passwd
party_identification_type: GoogleScholar
---
# Temp ID
`;

    fs.writeFileSync(tempIdFile, tempContent, 'utf-8');

    try {
      const response = await fetch(`${API_URL}/api/researchers/pty_temp_invalid/scholar-file`);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid scholar ID format');
    } finally {
      // Cleanup
      if (fs.existsSync(tempIdFile)) {
        fs.unlinkSync(tempIdFile);
      }
    }
  });
});
