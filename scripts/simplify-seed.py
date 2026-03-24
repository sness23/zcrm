#!/usr/bin/env python3
"""
Simplifies seed-real.ts by removing all optional fields from createEvent calls.
Only keeps the minimal required fields for each entity type.
"""

import re
from pathlib import Path

REQUIRED_FIELDS = {
    'party': {'id', 'name', 'party_type', 'type'},
    'individual': {'id', 'type', 'name', 'party_id', 'person_name'},
    'researcher-profile': {'id', 'type', 'party_id', 'individual_id'},
    'organization': {'id', 'type', 'party_id', 'business_name'},
}

def simplify_create_event(match):
    """Simplify a createEvent call by removing optional fields."""
    full_match = match.group(0)
    indent = match.group(1)
    entity_type = match.group(2)
    var_name = match.group(3)
    object_content = match.group(4)

    required = REQUIRED_FIELDS.get(entity_type)
    if not required:
        # Unknown entity type, don't modify
        return full_match

    # Extract all field assignments
    field_pattern = r'^\s*(\w+):\s*(.+?)(?:,\s*)?$'
    lines = object_content.split('\n')
    kept_fields = []

    for line in lines:
        field_match = re.match(field_pattern, line)
        if field_match:
            field_name = field_match.group(1)
            field_value = field_match.group(2).rstrip(',')
            if field_name in required:
                kept_fields.append(f"    {field_name}: {field_value}")

    # Rebuild the simplified object
    simplified_fields = ',\n'.join(kept_fields)
    return f"{indent}await createEvent('create', '{entity_type}', {var_name}, {{\n{simplified_fields}\n  }});"

# Read seed-real.ts
seed_path = Path('scripts/seed-real.ts')
content = seed_path.read_text()

# Pattern to match createEvent calls (multi-line, non-greedy)
pattern = r"^(\s*)await createEvent\('create', '([^']+)', (\w+), \{(.*?)\}\);"
simplified = re.sub(pattern, simplify_create_event, content, flags=re.MULTILINE | re.DOTALL)

# Write back
seed_path.write_text(simplified)

print('✅ Simplified seed-real.ts successfully!')
print('📊 Removed all optional fields from createEvent calls')
print('🔍 Kept only required fields for each entity type:')
for entity_type, fields in REQUIRED_FIELDS.items():
    print(f"  - {entity_type}: {', '.join(sorted(fields))}")
