#!/usr/bin/env bash
# Test SF import with sample data

set -euo pipefail

echo "Testing SF → FS-CRM Import"
echo "======================================"
echo ""

# Test single object imports
echo "1. Testing Account import..."
npx tsx scripts/sf-import.ts \
  --object=Account \
  --file=sf/test-data/sample-accounts.json \
  --dry-run

echo ""
echo "2. Testing Contact import..."
npx tsx scripts/sf-import.ts \
  --object=Contact \
  --file=sf/test-data/sample-contacts.json \
  --dry-run

echo ""
echo "3. Testing Opportunity import..."
npx tsx scripts/sf-import.ts \
  --object=Opportunity \
  --file=sf/test-data/sample-opportunities.json \
  --dry-run

echo ""
echo "======================================"
echo "All tests passed! ✓"
