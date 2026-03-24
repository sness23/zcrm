# Salesforce Metadata Extraction Script

## Overview

`get-sf.sh` is a comprehensive Bash script that extracts complete metadata, source code, and schema information from a Salesforce org. It creates a timestamped snapshot of your org's configuration, custom code, and data model for backup, analysis, or migration purposes.

## Purpose

This script serves multiple use cases:
- **Full org backups**: Capture complete metadata state at a point in time
- **Migration preparation**: Export metadata for deployment to another org
- **Documentation**: Generate machine-readable snapshots of your data model
- **Version control**: Track changes to Salesforce configuration over time
- **Schema analysis**: Extract detailed information about objects and fields for integration projects

## Prerequisites

### Required Software

1. **Salesforce CLI (sf)**
   ```bash
   npm install -g @salesforce/cli
   ```

2. **jq** (JSON processor)
   ```bash
   # Ubuntu/Debian
   sudo apt-get install jq

   # macOS
   brew install jq
   ```

3. **unzip** (usually pre-installed on Linux/macOS)

### Authentication

You must be authenticated to your Salesforce org with the alias `snessorg`. The script will prompt you to log in via web browser if not already authenticated:

```bash
sf org login web -a snessorg
```

## Usage

### Basic Execution

```bash
./get-sf.sh
```

The script is safe to run multiple times - each execution creates a new timestamped directory without overwriting previous snapshots.

### Permissions

Ensure the script is executable:
```bash
chmod +x get-sf.sh
```

## What the Script Does

### Step-by-Step Breakdown

#### 1. **Workspace Initialization**
Creates a timestamped workspace directory structure:
```
sf-dump-YYYYMMDD-HHMMSS/
├── out/
│   ├── mdapi/
│   └── describes/
└── sness-backup/  (created in step 3)
```

#### 2. **Salesforce CLI Login**
- Attempts to authenticate with alias `snessorg` (non-blocking)
- Captures org display information (org ID, instance URL, username, etc.)
- Output: `out/org-display.json`

#### 3. **Metadata Surface Exploration**
- **Lists all metadata types** available in the org (CustomObject, ApexClass, Flow, etc.)
  - Output: `out/metadata-types.json`
- **Lists all sObjects** (standard and custom objects)
  - Output: `out/sobjects.json`

#### 4. **DX Project Generation**
- Creates a Salesforce DX project structure named `sness-backup`
- Generates a comprehensive manifest (`package.xml`) from the org containing ALL metadata present
- Manifest includes: custom objects, fields, Apex classes, triggers, flows, validation rules, page layouts, profiles, permission sets, etc.
- Output: `sness-backup/manifest/allMetadata/package.xml`
- Backup copy: `out/manifest-copy/allMetadata/package.xml`

#### 5. **Source Format Retrieval**
- Retrieves metadata in **Salesforce DX source format** (modern, human-readable structure)
- Uses the generated manifest to pull everything from the org
- Source files written to: `sness-backup/force-app/`
- Output log: `out/retrieve-source.json`

This is the **primary output** for version control and modern Salesforce development.

#### 6. **MDAPI Format Retrieval**
- Retrieves metadata in **legacy Metadata API format** (ZIP archive)
- Downloads: `out/mdapi/unpackaged.zip`
- Extracts to: `out/mdapi/unpackaged/`
- Converts MDAPI → source format: `out/mdapi/src/`

Useful for compatibility with older tools or comparing format differences.

#### 7. **Schema Exports via Tooling API**

Two comprehensive SOQL queries capture the complete data model:

**EntityDefinition Query:**
```sql
SELECT QualifiedApiName, Label, IsCustomObject, IsQueryable, IsUpdatable
FROM EntityDefinition
```
- Lists all entities (objects) in the org
- Output: `out/EntityDefinition.json`

**FieldDefinition Query:**
```sql
SELECT EntityDefinition.QualifiedApiName, QualifiedApiName, Label, DataType,
       Length, Precision, Scale, IsCalculated, IsNillable
FROM FieldDefinition
```
- Lists ALL fields across ALL objects
- Output: `out/FieldDefinition.json` (can be large - 10MB+ in complex orgs)

#### 8. **Per-sObject Detailed Describes**

For each sObject discovered in step 3:
- Runs `sf sobject describe` to get full REST-like metadata
- Captures: fields, relationships, record types, child relationships, permissions
- Output: `out/describes/<ObjectName>.json` (one file per object)

These are the **most detailed** object descriptions, including relationship details and UI metadata.

#### 9. **API Limits Snapshot**

Captures current API usage and limits:
- Daily API request limits
- Data storage limits
- File storage limits
- Output: `out/limits.json`

Useful for capacity planning and monitoring.

## Output Structure

After successful execution, the workspace contains:

```
sf-dump-YYYYMMDD-HHMMSS/
├── out/
│   ├── org-display.json          # Org info (ID, URL, user)
│   ├── metadata-types.json       # All metadata types available
│   ├── sobjects.json             # List of all sObjects
│   ├── EntityDefinition.json     # All entities via Tooling API
│   ├── FieldDefinition.json      # All fields via Tooling API
│   ├── limits.json               # API limits snapshot
│   ├── retrieve-source.json      # Source retrieval log
│   ├── manifest-copy/            # Backup of package.xml
│   │   └── allMetadata/
│   │       └── package.xml
│   ├── mdapi/
│   │   ├── unpackaged.zip        # MDAPI ZIP archive
│   │   ├── unpackaged/           # Extracted MDAPI format
│   │   └── src/                  # MDAPI converted to source
│   └── describes/
│       ├── Account.json          # Per-object REST describes
│       ├── Contact.json
│       ├── CustomObject__c.json
│       └── ...
└── sness-backup/                 # DX project
    ├── force-app/                # ⭐ PRIMARY SOURCE OUTPUT
    │   └── main/
    │       └── default/
    │           ├── objects/
    │           ├── classes/
    │           ├── triggers/
    │           ├── flows/
    │           ├── layouts/
    │           └── ...
    ├── manifest/
    │   └── allMetadata/
    │       └── package.xml       # Complete org manifest
    └── sfdx-project.json         # DX project config
```

## Key Outputs Explained

### Primary Source: `sness-backup/force-app/`
- **Modern Salesforce DX format** - best for version control (Git)
- Organized by metadata type (objects/, classes/, triggers/, etc.)
- Human-readable XML with granular files
- **Recommended for** development, CI/CD, and source control

### Schema Exports: `out/EntityDefinition.json` & `out/FieldDefinition.json`
- **Machine-queryable** JSON format
- Complete field metadata including data types, lengths, nullability
- **Recommended for** integration mapping, data modeling, automated schema analysis

### Detailed Describes: `out/describes/*.json`
- **Most comprehensive** per-object metadata
- Includes relationships, picklist values, record types, child objects
- **Recommended for** deep object analysis, relationship mapping, UI metadata

### MDAPI Format: `out/mdapi/`
- **Legacy format** for compatibility
- Single XML files per metadata type
- **Recommended for** older deployment tools, migration utilities

### Manifest: `manifest/allMetadata/package.xml`
- **Deployment descriptor** listing all retrieved metadata
- Can be used with `sf project deploy` or `sf project retrieve`
- **Recommended for** selective deployments, manifest comparisons

## Use Cases

### 1. Daily Backups
```bash
# Run daily via cron
0 2 * * * cd /path/to/sf && ./get-sf.sh
```

### 2. Pre-Deployment Snapshots
```bash
# Capture org state before major changes
./get-sf.sh
# Review timestamp, then deploy
sf project deploy start -x manifest/allMetadata/package.xml
```

### 3. Schema Documentation
```bash
# Extract and analyze schema
./get-sf.sh
jq '.result.records[] | {object: .EntityDefinition.QualifiedApiName, field: .QualifiedApiName, type: .DataType}' \
  sf-dump-*/out/FieldDefinition.json > schema-report.json
```

### 4. Version Control Integration
```bash
# After extraction, commit source to Git
./get-sf.sh
cd sf-dump-*/sness-backup/force-app
git init
git add .
git commit -m "Org snapshot $(date +%Y-%m-%d)"
```

### 5. Cross-Org Comparison
```bash
# Extract from two orgs with different aliases
./get-sf.sh  # uses snessorg
# Edit script to use different org alias, run again
diff -r sf-dump-1/sness-backup/force-app sf-dump-2/sness-backup/force-app
```

## Troubleshooting

### Error: "schema sobject list is not a sf command"
**Fix**: Update Salesforce CLI to latest version
```bash
npm update -g @salesforce/cli
```

The script now uses the correct commands (`sf sobject list`, not `sf schema sobject list`).

### Error: "jq: command not found"
**Fix**: Install jq JSON processor
```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq
```

### Error: "No org configuration found for name snessorg"
**Fix**: Authenticate with the org
```bash
sf org login web -a snessorg
```

### Error: Permission denied when running script
**Fix**: Make script executable
```bash
chmod +x get-sf.sh
```

### Retrieval takes very long (>30 minutes)
**Cause**: Large orgs with thousands of metadata items can take time
**Solutions**:
- Run during off-peak hours
- Consider retrieving specific metadata types instead of full org
- Check network connectivity to Salesforce

### Out of disk space
**Cause**: Large orgs can produce multi-GB exports
**Solution**:
- Clean up old `sf-dump-*` directories
- Compress old snapshots: `tar -czf sf-dump-old.tar.gz sf-dump-*`

## Script Configuration

### Changing Org Alias
Edit line 16 to use a different org alias:
```bash
sf org login web -a snessorg  # Change 'snessorg' to your alias
```

Then update all `-o snessorg` flags throughout the script.

### Skipping Steps
Comment out sections you don't need:
```bash
# Skip MDAPI retrieval (lines 49-61) if only need source format
# Skip per-object describes (lines 74-80) if only need schema exports
```

### Custom Manifest
Instead of generating a manifest from org, use a custom one:
```bash
# Comment out lines 32-36
# Provide your own package.xml in manifest/allMetadata/
```

## Performance Notes

- **Small orgs** (< 100 custom objects): ~5-10 minutes
- **Medium orgs** (100-500 custom objects): ~15-30 minutes
- **Large orgs** (500+ custom objects): 30 minutes - 2 hours
- **Step 8** (per-object describes) is the slowest - one API call per object

## Security Considerations

- **Credentials**: The script does not store credentials; relies on SF CLI OAuth tokens
- **Sensitive Data**: Does NOT extract actual records, only metadata and schema
- **Org Access**: Requires full metadata read permissions (typically System Administrator profile)
- **Output Sensitivity**: Exported metadata may contain:
  - Custom object/field names (potential business logic exposure)
  - Apex code (intellectual property)
  - Validation rules and formulas (business rules)

  ⚠️ **Treat output directories as sensitive** - do not commit to public repositories without review.

## Related Commands

### Deploy back to org
```bash
cd sf-dump-*/sness-backup
sf project deploy start -x manifest/allMetadata/package.xml -o targetorg
```

### Validate deployment (don't actually deploy)
```bash
sf project deploy start -x manifest/allMetadata/package.xml -o targetorg --dry-run
```

### Retrieve specific metadata types only
```bash
sf project retrieve start -o snessorg -m "ApexClass,ApexTrigger,CustomObject"
```

### Convert between formats
```bash
# Source → MDAPI
sf project convert source -r force-app -d mdapi-output

# MDAPI → Source
sf project convert mdapi -r mdapi-output -d force-app
```

## Changelog

### 2025-10-13
- Fixed deprecated commands (`sf schema sobject` → `sf sobject`)
- Updated for Salesforce CLI v2.x compatibility

### Earlier
- Initial script version with comprehensive metadata extraction

## License

This script is part of the Zax CRM project. Use freely for your Salesforce backup and documentation needs.

## Contributing

To improve this script:
1. Test changes on a sandbox org first
2. Ensure compatibility with latest Salesforce CLI
3. Document any new steps or outputs
4. Consider performance impact on large orgs

## Support

For issues or questions:
- Check Salesforce CLI docs: https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/
- Review script output in `out/` directory for error details
- Verify org permissions if retrieval fails
