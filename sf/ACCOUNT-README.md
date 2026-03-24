# Salesforce Account Entity - Comprehensive Documentation

## Overview

The **Account** object is one of the core standard objects in Salesforce CRM. It represents companies, organizations, or individuals with whom you do business. Accounts are the foundation of the Salesforce data model, serving as the parent entity for many other objects like Contacts, Opportunities, Cases, and Contracts.

**Object API Name**: `Account`
**Object Type**: Standard Object
**Custom**: No
**Feed Enabled**: Yes (Chatter enabled)
**Deletable**: Yes
**Createable**: Yes
**Compact Layoutable**: Yes

## Entity Capabilities

- **Activateable**: No (standard object, always active)
- **Deep Cloneable**: No
- **Search**: Fully searchable
- **History Tracking**: Enabled (AccountHistory child object)
- **Feed Tracking**: Enabled (AccountFeed for Chatter posts)
- **Custom Setting**: No
- **Sharing Model**: Private/Public Read/Write (configurable via Organization-Wide Defaults)

## Data Model

### Object Relationships

#### Parent Relationships

1. **Self-Referencing Hierarchy**
   - Field: `ParentId`
   - Type: Hierarchy (Account → Account)
   - Use Case: Model corporate hierarchies, parent companies, subsidiaries
   - Relationship Name: `Parent`

2. **Owner**
   - Field: `OwnerId`
   - Type: Lookup(User)
   - Required: Yes
   - Relationship: Every Account must have an owner (User)

#### Child Relationships (Key)

The Account object has **90+ child relationships**. Here are the most important ones:

##### Core Business Objects

1. **Contacts** (`Contacts`)
   - Child Object: `Contact`
   - Field: `AccountId`
   - Cascade Delete: Yes
   - Purpose: Individuals associated with the Account
   - Relationship: One-to-Many

2. **Opportunities** (`Opportunities`)
   - Child Object: `Opportunity`
   - Field: `AccountId`
   - Cascade Delete: Yes
   - Purpose: Sales deals/pipelines for this Account
   - Relationship: One-to-Many

3. **Cases** (`Cases`)
   - Child Object: `Case`
   - Field: `AccountId`
   - Cascade Delete: No (Restricted Delete)
   - Purpose: Customer support tickets
   - Relationship: One-to-Many

4. **Contracts** (`Contracts`)
   - Child Object: `Contract`
   - Field: `AccountId`
   - Cascade Delete: Yes
   - Purpose: Contractual agreements
   - Relationship: One-to-Many

5. **Orders** (`Orders`)
   - Child Object: `Order`
   - Field: `AccountId`
   - Cascade Delete: Yes (Restricted Delete)
   - Purpose: Customer orders/purchases
   - Relationship: One-to-Many

##### Activities

6. **Tasks** (`Tasks`)
   - Child Object: `Task`
   - Field: `WhatId`
   - Cascade Delete: Yes
   - Purpose: To-do items related to Account

7. **Events** (`Events`)
   - Child Object: `Event`
   - Field: `WhatId`
   - Cascade Delete: Yes
   - Purpose: Calendar events/meetings

8. **ActivityHistory** (`ActivityHistories`)
   - Child Object: `ActivityHistory`
   - Purpose: Completed Tasks and Events

9. **OpenActivity** (`OpenActivities`)
   - Child Object: `OpenActivity`
   - Purpose: Uncompleted Tasks and Events

##### Junction Objects

10. **AccountContactRole** (`AccountContactRoles`)
    - Purpose: Links Contacts to Accounts with specific roles
    - Cascade Delete: Yes

11. **AccountPartner** (`AccountPartnersFrom`, `AccountPartnersTo`)
    - Purpose: Partner relationships between Accounts
    - Cascade Delete: Yes

##### Content & Collaboration

12. **Attachments** (`Attachments`)
    - Purpose: File attachments (legacy)
    - Cascade Delete: Yes

13. **ContentDocumentLink** (`ContentDocumentLinks`)
    - Purpose: Files/documents (Salesforce Files)
    - Cascade Delete: Yes

14. **Notes** (`Notes`)
    - Purpose: Text notes
    - Cascade Delete: Yes

15. **AccountFeed** (`Feeds`)
    - Purpose: Chatter feed posts
    - Cascade Delete: Yes

##### History & Sharing

16. **AccountHistory** (`Histories`)
    - Purpose: Field history tracking
    - Cascade Delete: Yes

17. **AccountShare** (`Shares`)
    - Purpose: Record-level sharing rules
    - Cascade Delete: Yes

##### Change Data Capture & Events

18. **AccountChangeEvent** (Change Events)
    - Purpose: Real-time change notifications for integrations

19. **AccountCleanInfo** (`AccountCleanInfos`)
    - Purpose: Data.com data cleansing information
    - Cascade Delete: Yes

##### Assets

20. **Assets** (`Assets`)
    - Purpose: Products purchased by Account
    - Cascade Delete: Yes

**Full Child Relationship Count**: 90 child relationships

## Field Schema

The Account object has **51 fields** (standard + custom). Below is the complete field inventory:

### Identity Fields

| API Name | Label | Type | Required | Notes |
|----------|-------|------|----------|-------|
| `Id` | Account ID | Lookup() | Yes | 18-character unique identifier |
| `IsDeleted` | Deleted | Checkbox | Yes | Soft-delete flag |
| `MasterRecordId` | Account | Lookup(Account) | No | Master record after merge |
| `Name` | Account Name | Name | Yes | Primary display name (max 255 chars) |

### Contact Information

| API Name | Label | Type | Length | Notes |
|----------|-------|------|--------|-------|
| `Phone` | Phone | Phone | 40 | Primary phone number |
| `Fax` | Fax | Phone | 40 | Fax number |
| `Website` | Website | URL | 255 | Company website |
| `PhotoUrl` | Photo URL | URL | 255 | Account logo/photo |

### Address Fields

| API Name | Label | Type | Components |
|----------|-------|------|------------|
| `BillingAddress` | Billing Address | Address | Street, City, State, Postal Code, Country |
| `ShippingAddress` | Shipping Address | Address | Street, City, State, Postal Code, Country |

**Note**: Each Address compound field breaks down into:
- `BillingStreet` / `ShippingStreet`
- `BillingCity` / `ShippingCity`
- `BillingState` / `ShippingState`
- `BillingPostalCode` / `ShippingPostalCode`
- `BillingCountry` / `ShippingCountry`
- `BillingGeocodeAccuracy` / `ShippingGeocodeAccuracy`
- `BillingLatitude` / `ShippingLatitude`
- `BillingLongitude` / `ShippingLongitude`

### Company Information

| API Name | Label | Type | Length/Precision | Nullable |
|----------|-------|------|------------------|----------|
| `AccountNumber` | Account Number | Text | 40 | Yes |
| `Site` | Account Site | Text | 80 | Yes |
| `Type` | Type | Picklist | 255 | Yes |
| `Industry` | Industry | Picklist | 255 | Yes |
| `AnnualRevenue` | Annual Revenue | Currency | 18,0 | Yes |
| `NumberOfEmployees` | Employees | Number | 8,0 | Yes |
| `Ownership` | Ownership | Picklist | 255 | Yes |
| `TickerSymbol` | Ticker Symbol | Text | 20 | Yes |
| `Description` | Description | Long Text Area | 32,000 | Yes |
| `Rating` | Rating | Picklist | 255 | Yes |
| `AccountSource` | Account Source | Picklist | 255 | Yes |
| `YearStarted` | Year Started | Text | 4 | Yes |
| `Tradestyle` | Tradestyle | Text | 255 | Yes |

### Industry Classification

| API Name | Label | Type | Length | Notes |
|----------|-------|------|--------|-------|
| `Sic` | SIC Code | Text | 20 | Standard Industrial Classification |
| `SicDesc` | SIC Description | Text | 80 | SIC code description |
| `NaicsCode` | NAICS Code | Text | 8 | North American Industry Classification |
| `NaicsDesc` | NAICS Description | Text | 120 | NAICS description |

### Data Enrichment (D&B / Data.com)

| API Name | Label | Type | Length | Notes |
|----------|-------|------|--------|-------|
| `DunsNumber` | D-U-N-S Number | Text | 9 | Dun & Bradstreet identifier |
| `DandbCompanyId` | D&B Company | Lookup(DandBCompany) | 18 | Reference to D&B Company record |
| `Jigsaw` | Data.com Key | Text | 20 | Legacy Data.com identifier |
| `JigsawCompanyId` | Jigsaw Company Id | External Lookup | 20 | Legacy external ID |
| `CleanStatus` | Clean Status | Picklist | 40 | Data quality status |

### System Fields

| API Name | Label | Type | Notes |
|----------|-------|------|-------|
| `CreatedById` | Created By | Lookup(User) | User who created record |
| `CreatedDate` | Created Date | Date/Time | Record creation timestamp |
| `LastModifiedById` | Last Modified By | Lookup(User) | Last user to edit |
| `LastModifiedDate` | Last Modified Date | Date/Time | Last edit timestamp |
| `SystemModstamp` | System Modstamp | Date/Time | System modification timestamp |
| `LastActivityDate` | Last Activity | Date | Date of last logged activity |
| `LastViewedDate` | Last Viewed Date | Date/Time | Last time record was viewed |
| `LastReferencedDate` | Last Referenced Date | Date/Time | Last time referenced in UI |

### Hierarchy & Ownership

| API Name | Label | Type | Notes |
|----------|-------|------|-------|
| `ParentId` | Parent Account | Hierarchy | Link to parent Account |
| `OwnerId` | Account Owner | Lookup(User) | Record owner (required) |

### Access Control

| API Name | Label | Type | Notes |
|----------|-------|------|-------|
| `UserRecordAccessId` | Object Access Level | Lookup(UserRecordAccess) | Current user's access level |

## Custom Fields

This org has **8 custom fields** on the Account object:

| API Name | Label | Type | Length/Precision | Nullable | Purpose |
|----------|-------|------|------------------|----------|---------|
| `Active__c` | Active | Picklist | 255 | Yes | Customer active status |
| `CustomerPriority__c` | Customer Priority | Picklist | 255 | Yes | Priority tier classification |
| `NumberofLocations__c` | Number of Locations | Number | 3,0 | Yes | Count of physical locations |
| `SLA__c` | SLA | Picklist | 255 | Yes | Service Level Agreement tier |
| `SLAExpirationDate__c` | SLA Expiration Date | Date | - | Yes | SLA contract expiration |
| `SLASerialNumber__c` | SLA Serial Number | Text | 10 | Yes | SLA contract identifier |
| `UpsellOpportunity__c` | Upsell Opportunity | Picklist | 255 | Yes | Upsell potential indicator |
| `ccomorder__c` | ccomorder | External Lookup(ccomorder__x) | 254 | Yes | External system integration |

### Custom Field Analysis

**Active__c**: Tracks whether the Account is an active customer. Likely values: "Yes", "No", potentially "Inactive", "Dormant", etc.

**CustomerPriority__c**: Classifies customers by importance/revenue tier. Common patterns:
- High / Medium / Low
- Platinum / Gold / Silver / Bronze
- Tier 1 / Tier 2 / Tier 3

**NumberofLocations__c**: Physical locations or branches. Useful for enterprise accounts with multiple offices. Max value: 999 (3 digits).

**SLA Fields** (3 fields):
- `SLA__c`: Service level commitment (e.g., "Gold", "Platinum")
- `SLAExpirationDate__c`: When SLA contract ends
- `SLASerialNumber__c`: Contract tracking number

**UpsellOpportunity__c**: Sales team indicator for cross-sell/upsell potential. Likely values: "High", "Medium", "Low", "None".

**ccomorder__c**: External lookup to `ccomorder__x` (external object). This suggests integration with an external order management system via Salesforce Connect.

## Picklist Values

To retrieve picklist values for standard and custom fields, use:

```bash
sf data query -o myorg -q "SELECT QualifiedApiName, PicklistValueSetApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'Account' AND DataType LIKE '%Picklist%'" --json

# Or for specific field values:
sf sobject describe -o myorg -s Account --json | jq '.result.fields[] | select(.name=="Type") | .picklistValues'
```

Common Picklist Fields:
- `Type`: Prospect, Customer - Direct, Customer - Channel, Channel Partner / Reseller, Installation Partner, Technology Partner, Other
- `Industry`: Agriculture, Apparel, Banking, Biotechnology, Chemicals, Communications, Construction, Consulting, Education, Electronics, Energy, Engineering, Entertainment, Environmental, Finance, Food & Beverage, Government, Healthcare, Hospitality, Insurance, Machinery, Manufacturing, Media, Not For Profit, Other, Recreation, Retail, Shipping, Technology, Telecommunications, Transportation, Utilities
- `Rating`: Hot, Warm, Cold
- `Ownership`: Public, Private, Subsidiary, Other
- `AccountSource`: Web, Phone Inquiry, Partner Referral, Purchased List, Other

## Page Layouts & UI Configuration

### Compact Layout

**Name**: `Sales_View_Compact_Layout`
**Purpose**: Compact layouts control which fields appear in the record highlights panel (top of page) and in hover details.

To retrieve layout details:
```bash
sf data query -o myorg -q "SELECT Id, Name, PrimaryField, SobjectType, (SELECT FieldApiName FROM FieldLayoutItems ORDER BY CreatedDate) FROM CompactLayout WHERE SobjectType = 'Account' AND Name = 'Sales_View_Compact_Layout'" --json
```

### Page Layouts

Standard layouts likely include:
- **Account Layout** (default)
- **Sales View Layout**
- Record type-specific layouts (if record types exist)

To check available layouts:
```bash
sf data query -o myorg -q "SELECT Id, Name, EntityDefinitionId FROM Layout WHERE EntityDefinitionId = '001000000000000AAA'" --json
```

### Custom Action Override

The org has a **custom page override** for the Account View action:
- **Action**: View
- **Form Factor**: LARGE (desktop)
- **Page ID**: `0M01a000000CbwmCAC`
- **Type**: Likely Visualforce Page or Lightning Page

This means clicking on an Account record opens a custom page instead of the standard layout.

## Record Types

To check if Account has record types:
```bash
sf data query -o myorg -q "SELECT Id, Name, DeveloperName, Description FROM RecordType WHERE SobjectType = 'Account'" --json
```

Record types enable different page layouts, picklist values, and business processes for different account types (e.g., "Corporate Account", "Individual Account", "Partner Account").

## Validation Rules & Automation

### Validation Rules

To retrieve validation rules:
```bash
sf data query -o myorg -q "SELECT ValidationName, ErrorMessage, ErrorDisplayField, Active FROM ValidationRule WHERE EntityDefinitionId = 'Account'" --json
```

Common validation patterns:
- Required fields for certain account types
- Phone/email format validation
- Parent account restrictions (prevent circular hierarchies)
- SLA date validations (expiration must be future)

### Workflow Rules & Process Builder

To check automation:
```bash
sf data query -o myorg -q "SELECT Name, Type FROM WorkflowRule WHERE TableEnumOrId = 'Account'" --json
```

## Business Use Cases

### 1. Corporate Hierarchy Modeling

Use `ParentId` to build multi-level account hierarchies:

```sql
-- Get all child accounts of a parent
SELECT Id, Name, ParentId, Parent.Name
FROM Account
WHERE ParentId = '001xxxxxxxxxxxxxxx'

-- Get full hierarchy path
SELECT Id, Name, Parent.Name, Parent.Parent.Name
FROM Account
WHERE Id = '001xxxxxxxxxxxxxxx'
```

### 2. Account Segmentation

Segment accounts by priority and SLA:

```sql
SELECT Name, CustomerPriority__c, SLA__c, AnnualRevenue, NumberOfEmployees
FROM Account
WHERE CustomerPriority__c = 'High'
AND SLA__c IN ('Gold', 'Platinum')
ORDER BY AnnualRevenue DESC
```

### 3. SLA Management

Track expiring SLAs:

```sql
SELECT Name, SLA__c, SLAExpirationDate__c, Owner.Name
FROM Account
WHERE SLAExpirationDate__c <= NEXT_N_DAYS:90
AND SLAExpirationDate__c != NULL
ORDER BY SLAExpirationDate__c ASC
```

### 4. Active Customer Analysis

```sql
SELECT COUNT(Id) TotalAccounts,
       COUNT_DISTINCT(Industry) Industries,
       SUM(AnnualRevenue) TotalRevenue,
       AVG(NumberOfEmployees) AvgEmployees
FROM Account
WHERE Active__c = 'Yes'
AND Type LIKE 'Customer%'
```

### 5. Multi-Location Accounts

```sql
SELECT Name, NumberofLocations__c, BillingState, BillingCountry
FROM Account
WHERE NumberofLocations__c > 10
ORDER BY NumberofLocations__c DESC
```

### 6. Upsell Pipeline

```sql
SELECT Name, UpsellOpportunity__c, AnnualRevenue, Industry, Owner.Name
FROM Account
WHERE UpsellOpportunity__c IN ('High', 'Medium')
AND Active__c = 'Yes'
ORDER BY AnnualRevenue DESC
```

## Integration Patterns

### External System Integration

The `ccomorder__c` field links to an external object (`ccomorder__x`), indicating:

1. **Salesforce Connect** integration
2. External orders system (likely e-commerce or ERP)
3. Real-time data access without data replication

Query pattern:
```sql
SELECT Name, ccomorder__c, ccomorder__r.ExternalField__c
FROM Account
WHERE ccomorder__c != NULL
```

### Change Data Capture

Account supports **Change Data Capture** via `AccountChangeEvent`. This enables:

- Real-time integration triggers
- Event-driven architectures
- External system sync on field changes

Subscribe to events:
```apex
trigger AccountChangeEventTrigger on AccountChangeEvent (after insert) {
    for (AccountChangeEvent event : Trigger.new) {
        // Process change event
        System.debug('Account changed: ' + event.changeEventHeader);
    }
}
```

## Data Quality & Cleansing

### Data.com / D&B Integration

Fields for data enrichment:
- `DunsNumber`: Dun & Bradstreet unique identifier
- `DandbCompanyId`: Lookup to D&B Company records
- `CleanStatus`: Data quality indicator
- `AccountCleanInfo`: Child object with cleansing metadata

### Deduplication

The org supports:
- **Matching Rules** (Account.Name, Website, etc.)
- **Duplicate Rules** for prevention/alerting
- Merge functionality (writes to `MasterRecordId`)

Query duplicates:
```sql
SELECT AccountId, RecordId, DuplicateRecordSetId
FROM DuplicateRecordItem
WHERE RecordId IN (SELECT Id FROM Account WHERE Name = 'Acme Corp')
```

## Sharing & Security

### Organization-Wide Default (OWD)

Common configurations:
- **Private**: Only owner + roles above can see
- **Public Read Only**: All users can view, only owner can edit
- **Public Read/Write**: All users can view and edit

### Sharing Rules

Account supports:
- **Criteria-based sharing**: Share accounts matching filters (e.g., Industry = 'Technology')
- **Ownership-based sharing**: Share accounts owned by certain users/groups

### Manual Sharing

Querying shares:
```sql
SELECT AccountId, UserOrGroupId, AccountAccessLevel, RowCause
FROM AccountShare
WHERE AccountId = '001xxxxxxxxxxxxxxx'
```

### Field-Level Security (FLS)

Custom fields may have restricted visibility by profile/permission set. Check FLS:
```bash
sf data query -o myorg -q "SELECT Parent.Name, Field, PermissionsRead, PermissionsEdit FROM FieldPermissions WHERE SobjectType = 'Account' AND Field LIKE 'Account.%'" --json
```

## Reporting & Analytics

### Standard Reports

Common Account report types:
- **Accounts with Opportunities**: Accounts + related Opps
- **Accounts with Cases**: Support analysis
- **Accounts with Contacts**: Relationship mapping
- **Account History**: Field audit trail

### Custom Report Types

Create custom report types for:
- Accounts with SLA details
- Multi-location account analysis
- Active accounts with upsell opportunity
- Accounts + external order data

### Dashboard KPIs

Key metrics:
- Total active accounts
- Accounts by priority tier
- Expiring SLAs (next 30/60/90 days)
- Accounts with high upsell opportunity
- Average annual revenue by industry
- New accounts created (this month/quarter/year)

## Apex & Development

### Triggers

Check for existing triggers:
```bash
sf data query -o myorg -q "SELECT Name, Status, BodyLength FROM ApexTrigger WHERE TableEnumOrId = 'Account'" --json
```

Common trigger patterns:
- Auto-populate SLA serial numbers
- Territory assignment based on address
- Parent account validation
- External system callouts on creation/update

### SOQL Patterns

**Efficient queries with relationships:**
```apex
// Query with parent
List<Account> accounts = [
    SELECT Id, Name, Parent.Name, Parent.Industry
    FROM Account
    WHERE ParentId != null
];

// Query with child aggregation
List<AggregateResult> results = [
    SELECT AccountId, COUNT(Id) OpptyCount, SUM(Amount) TotalAmount
    FROM Opportunity
    WHERE AccountId IN :accountIds
    GROUP BY AccountId
];

// Query with subquery
List<Account> accountsWithContacts = [
    SELECT Id, Name,
        (SELECT Id, FirstName, LastName, Email FROM Contacts)
    FROM Account
    WHERE Active__c = 'Yes'
];
```

### Apex Field Access

```apex
Account acc = new Account();
acc.Name = 'New Account';
acc.Active__c = 'Yes';
acc.CustomerPriority__c = 'High';
acc.SLA__c = 'Gold';
acc.SLAExpirationDate__c = Date.today().addYears(1);
acc.NumberofLocations__c = 5;
insert acc;
```

## API Access

### REST API

**Get Account by ID:**
```bash
curl https://yourinstance.salesforce.com/services/data/v65.0/sobjects/Account/001xxxxxx \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Query Accounts:**
```bash
curl "https://yourinstance.salesforce.com/services/data/v65.0/query?q=SELECT+Name+FROM+Account+WHERE+Active__c='Yes'" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Create Account:**
```bash
curl https://yourinstance.salesforce.com/services/data/v65.0/sobjects/Account \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "Name": "New Account",
    "Active__c": "Yes",
    "CustomerPriority__c": "High"
  }'
```

### SOAP API

Account supports full SOAP API operations:
- `create()`
- `update()`
- `delete()`
- `undelete()`
- `query()`
- `retrieve()`
- `merge()`

### Bulk API 2.0

For mass operations (>2000 records):
```bash
sf data upsert bulk -o myorg -s Account -f accounts.csv -i AccountNumber
```

## Performance Considerations

### Indexing

Salesforce automatically indexes:
- `Id`
- `Name`
- `OwnerId`
- `CreatedDate`
- `SystemModstamp`
- Lookup fields (`ParentId`, `DandbCompanyId`)
- External ID fields (mark custom fields as External ID)

Custom indexes can be requested for:
- High-query-volume fields (e.g., `Active__c`, `SLA__c`)
- Filter fields in list views/reports

### Query Optimization

**Bad:**
```sql
-- Avoid LIKE wildcards at start
SELECT Id FROM Account WHERE Name LIKE '%Corp'

-- Avoid querying large text fields
SELECT Description FROM Account WHERE Active__c = 'Yes'
```

**Good:**
```sql
-- Use indexed fields in WHERE
SELECT Id FROM Account WHERE Name = 'Acme Corp'

-- Limit fields returned
SELECT Id, Name, Active__c FROM Account WHERE Active__c = 'Yes'

-- Use LIMIT
SELECT Id, Name FROM Account WHERE Active__c = 'Yes' LIMIT 100
```

### Large Data Volumes (LDV)

If Account exceeds 1 million records:
- Enable **skinny tables** for frequently queried fields
- Use **Selective SOQL** (filter on indexed fields)
- Leverage **Bulk API** for mass operations
- Consider **Data Archival** for old inactive accounts

## Testing & Deployment

### Apex Tests

When deploying changes to Account:
- Test trigger coverage (75%+ required)
- Test with System.runAs() for sharing rules
- Test bulk scenarios (200+ records)
- Test governor limits

Example:
```apex
@isTest
private class AccountTriggerTest {
    @isTest
    static void testAccountCreation() {
        Account acc = new Account(
            Name = 'Test Account',
            Active__c = 'Yes',
            CustomerPriority__c = 'High'
        );

        Test.startTest();
        insert acc;
        Test.stopTest();

        Account result = [SELECT Id, Name FROM Account WHERE Id = :acc.Id];
        System.assertNotEquals(null, result.Id);
    }
}
```

### Deployment Checklist

When deploying Account customizations:

- [ ] Custom fields (`*__c`)
- [ ] Custom field metadata (Field-Level Security)
- [ ] Validation rules
- [ ] Page layouts
- [ ] Compact layouts
- [ ] Record types (if any)
- [ ] List views
- [ ] Triggers + test classes
- [ ] Workflow rules / Process Builder / Flows
- [ ] Sharing rules
- [ ] Report types
- [ ] Permission sets (field access)

### Migration Commands

```bash
# Retrieve Account metadata
sf project retrieve start -o myorg -m "CustomObject:Account"

# Deploy to target org
sf project deploy start -o targetorg -m "CustomObject:Account"

# Retrieve specific components
sf project retrieve start -o myorg -m "CustomField:Account.Active__c,Layout:Account-Account Layout"
```

## Monitoring & Maintenance

### Field Usage Analysis

Identify unused fields:
```bash
sf data query -o myorg -q "SELECT COUNT(Id) FROM Account WHERE Active__c != null" --json
```

### Storage Impact

Account records consume:
- **Data Storage**: ~2KB per record (base) + text field content
- **File Storage**: Attachments, Files (ContentDocumentLink)

Check org limits:
```bash
sf limits api display -o myorg --json | jq '.result | {DataStorageMB, FileStorageMB}'
```

### Audit Trail

Query field history:
```sql
SELECT Field, OldValue, NewValue, CreatedDate, CreatedBy.Name
FROM AccountHistory
WHERE AccountId = '001xxxxxxxxxxxxxxx'
ORDER BY CreatedDate DESC
```

## Common Customization Patterns

### 1. Auto-Number SLA Serial

Create workflow/flow to auto-populate `SLASerialNumber__c`:
- Format: `SLA-{YYYY}-{000001}`
- Use formula or Apex to generate sequential numbers

### 2. Territory Assignment

Use Process Builder/Flow to assign `OwnerId` based on:
- `BillingState` / `BillingCountry`
- `Industry`
- `AnnualRevenue` threshold

### 3. Parent Account Lookup Filters

Add dependent filters to ensure:
- Child accounts cannot select themselves as parent
- Parent must be same `Type` or specific types
- Prevent circular hierarchies (Apex trigger validation)

### 4. SLA Expiration Alerts

Create scheduled flow/Apex to:
- Query accounts with `SLAExpirationDate__c` in next 30/60/90 days
- Send email alerts to `Owner`
- Create Task for renewal follow-up

### 5. Priority Escalation

Auto-escalate `CustomerPriority__c` when:
- `AnnualRevenue` exceeds threshold
- Number of `Opportunities` (Amount > X) exceeds count
- `SLA__c` = 'Platinum'

## Related Objects

### Objects That Reference Account

- **Contact**: `AccountId`
- **Opportunity**: `AccountId`
- **Case**: `AccountId`
- **Contract**: `AccountId`
- **Order**: `AccountId`
- **Asset**: `AccountId`
- **Lead**: `ConvertedAccountId` (after conversion)
- **Task/Event**: `WhatId` (polymorphic)
- **Partner**: `AccountFromId`, `AccountToId`
- **AccountContactRole**: `AccountId`
- **AccountPartner**: `AccountFromId`, `AccountToId`
- **OpportunityPartner**: `AccountToId`

### External Objects

- **ccomorder__x**: External order system (via `ccomorder__c` lookup)

## Troubleshooting

### Common Errors

1. **REQUIRED_FIELD_MISSING**
   - Missing: `Name` (required)
   - Solution: Always provide Account Name

2. **DUPLICATE_VALUE**
   - Duplicate rule triggered
   - Solution: Check existing records, handle duplicates

3. **UNABLE_TO_LOCK_ROW**
   - Concurrent updates
   - Solution: Implement retry logic in integration

4. **FIELD_CUSTOM_VALIDATION_EXCEPTION**
   - Validation rule failed
   - Solution: Check validation rules, ensure data meets criteria

5. **INSUFFICIENT_ACCESS_OR_READONLY**
   - Sharing rule / FLS issue
   - Solution: Grant object-level or field-level access

### Debug Queries

```sql
-- Find accounts without owner
SELECT Id, Name FROM Account WHERE OwnerId = null

-- Find orphaned child accounts (parent deleted)
SELECT Id, Name, ParentId FROM Account WHERE ParentId != null
AND ParentId NOT IN (SELECT Id FROM Account)

-- Find accounts with no contacts
SELECT Id, Name FROM Account
WHERE Id NOT IN (SELECT AccountId FROM Contact WHERE AccountId != null)

-- Accounts with expired SLA
SELECT Id, Name, SLAExpirationDate__c FROM Account
WHERE SLAExpirationDate__c < TODAY
AND SLA__c != null
```

## Additional Resources

### Salesforce Documentation

- [Account Object Reference](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_account.htm)
- [Account Hierarchies](https://help.salesforce.com/articleView?id=sf.account_hierarchy.htm)
- [Account Sharing](https://help.salesforce.com/articleView?id=sf.sharing_accounts.htm)

### Trailhead Modules

- [Account Management](https://trailhead.salesforce.com/content/learn/modules/account-management)
- [Accounts & Contacts for Lightning Experience](https://trailhead.salesforce.com/content/learn/modules/accounts_contacts_lightning_experience)

### Schema Exploration Commands

```bash
# Full object describe (saved above)
sf sobject describe -o myorg -s Account --json > account-describe.json

# Field definitions query (saved above)
sf data query -o myorg -q "SELECT QualifiedApiName, Label, DataType FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'Account'" --json > account-fields.json

# Picklist values
sf data query -o myorg -q "SELECT QualifiedApiName, EntityParticleId, Label, IsActive FROM PicklistValueInfo WHERE EntityParticle.EntityDefinition.QualifiedApiName = 'Account'" --json

# Relationship info
sf data query -o myorg -q "SELECT QualifiedApiName, RelationshipName, ReferenceTo FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'Account' AND DataType LIKE '%Lookup%'" --json
```

## Org-Specific Configuration Summary

Based on the retrieved metadata for **your Salesforce org** (user@example.com):

- **Custom Fields**: 8 (Active, Priority, SLA suite, Locations, Upsell, External Order)
- **Compact Layout**: Sales_View_Compact_Layout
- **View Action Override**: Custom page (ID: 0M01a000000CbwmCAC)
- **External Integration**: ccomorder__x via Salesforce Connect
- **Data Enrichment**: D&B and Data.com fields present
- **Hierarchy Enabled**: Yes (`ParentId` field)
- **Feed Enabled**: Yes (Chatter)
- **History Tracking**: Yes (`AccountHistory` child)
- **Change Events**: Yes (`AccountChangeEvent`)

### Next Steps for Analysis

1. **Retrieve full metadata package**:
   ```bash
   sf project retrieve start -o myorg -m "CustomObject:Account"
   ```

2. **Analyze page layouts**:
   ```bash
   sf data query -o myorg -q "SELECT Id, Name FROM Layout WHERE EntityDefinitionId = '001000000000000AAA'" --json
   ```

3. **Check validation rules**:
   ```bash
   sf data query -o myorg -q "SELECT ValidationName, Active, ErrorMessage FROM ValidationRule WHERE EntityDefinitionId = 'Account'" --json
   ```

4. **Review triggers and classes**:
   ```bash
   sf data query -o myorg -q "SELECT Name, Status FROM ApexTrigger WHERE TableEnumOrId = 'Account'" --json
   ```

5. **Export sample data**:
   ```bash
   sf data export tree -o myorg -q "SELECT FIELDS(ALL) FROM Account WHERE Active__c = 'Yes' LIMIT 10" -x -d ./data
   ```

---

**Document Generated**: 2025-10-13
**Salesforce Org**: user@example.com
**Org ID**: 00D1a000000HIpGEAW
**API Version**: v65.0

**Data Sources**:
- `sf sobject describe` (90 child relationships, 51 fields)
- `sf data query` FieldDefinition (complete field schema)
- Retrieved manifest (`allMetadata.xml`)

**File Locations** (from `get-sf.sh` run):
- Object describe: `/tmp/account-describe.json`
- Field definitions: `/tmp/account-fields.json`
- Manifest: `sf-dump-20251013-051257/sness-backup/manifest/allMetadata.xml`
