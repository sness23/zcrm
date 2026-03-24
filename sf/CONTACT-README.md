# Salesforce Contact Entity - Comprehensive Documentation

## Overview

The **Contact** object is one of the core standard objects in Salesforce CRM. It represents individual people associated with your business—customers, partners, prospects, or other stakeholders. Contacts are typically linked to Accounts (companies) and are central to relationship management, sales processes, support cases, and marketing activities.

**Object API Name**: `Contact`
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
- **History Tracking**: Enabled (ContactHistory child object)
- **Feed Tracking**: Enabled (ContactFeed for Chatter posts)
- **Custom Setting**: No
- **Sharing Model**: Controlled by Parent Account or Private (configurable via Organization-Wide Defaults)

## Data Model

### Object Relationships

#### Parent Relationships

1. **Account**
   - Field: `AccountId`
   - Type: Lookup(Account)
   - Required: No (can have "person accounts" or unassociated contacts)
   - Use Case: Link Contact to their company/organization
   - Relationship Name: `Account`

2. **Reports To (Organizational Hierarchy)**
   - Field: `ReportsToId`
   - Type: Lookup(Contact)
   - Use Case: Model organizational reporting structure
   - Relationship Name: `ReportsTo`

3. **Owner**
   - Field: `OwnerId`
   - Type: Lookup(User)
   - Required: Yes
   - Relationship: Every Contact must have an owner (User)

4. **Individual (Data Privacy)**
   - Field: `IndividualId`
   - Type: Lookup(Individual)
   - Required: No
   - Use Case: GDPR/data privacy tracking and consent management

#### Child Relationships (Key)

The Contact object has **89 child relationships**. Here are the most important ones:

##### Core Business Objects

1. **Opportunities** (`Opportunities`)
   - Child Object: `Opportunity`
   - Field: `ContactId` (primary contact role)
   - Cascade Delete: No
   - Purpose: Sales deals associated with this Contact
   - Relationship: One-to-Many

2. **Cases** (`Cases`)
   - Child Object: `Case`
   - Field: `ContactId`
   - Cascade Delete: No
   - Purpose: Customer support tickets
   - Relationship: One-to-Many

3. **Assets** (`Assets`)
   - Child Object: `Asset`
   - Field: `ContactId`
   - Cascade Delete: Yes
   - Purpose: Products/assets assigned to this Contact
   - Relationship: One-to-Many

4. **Contracts** (`Contracts`)
   - Child Object: `Contract`
   - Field: `CustomerSignedId`
   - Cascade Delete: No
   - Purpose: Contracts where this Contact is the signatory
   - Relationship: One-to-Many

##### Activities

5. **Tasks** (`Tasks`)
   - Child Object: `Task`
   - Field: `WhoId`
   - Cascade Delete: Yes
   - Purpose: To-do items related to Contact

6. **Events** (`Events`)
   - Child Object: `Event`
   - Field: `WhoId`
   - Cascade Delete: Yes
   - Purpose: Calendar events/meetings

7. **ActivityHistory** (`ActivityHistories`)
   - Child Object: `ActivityHistory`
   - Purpose: Completed Tasks and Events

8. **OpenActivity** (`OpenActivities`)
   - Child Object: `OpenActivity`
   - Purpose: Uncompleted Tasks and Events

9. **EmailMessage** (`EmailMessages`)
   - Purpose: Email correspondence with Contact
   - Cascade Delete: No

##### Reporting Hierarchy

10. **Direct Reports** (`DirectReports`)
    - Child Object: `Contact`
    - Field: `ReportsToId`
    - Purpose: Contacts that report to this Contact
    - Cascade Delete: No

##### Junction Objects

11. **AccountContactRole** (`AccountContactRoles`)
    - Purpose: Links Contacts to Accounts with specific roles (Decision Maker, Influencer, etc.)
    - Cascade Delete: Yes

12. **OpportunityContactRole** (`OpportunityContactRoles`)
    - Purpose: Links Contacts to Opportunities with specific roles
    - Cascade Delete: Yes

13. **CampaignMember** (`CampaignMembers`)
    - Purpose: Marketing campaign participation
    - Cascade Delete: No

##### Content & Collaboration

14. **Attachments** (`Attachments`)
    - Purpose: File attachments (legacy)
    - Cascade Delete: Yes

15. **ContentDocumentLink** (`ContentDocumentLinks`)
    - Purpose: Files/documents (Salesforce Files)
    - Cascade Delete: Yes

16. **Notes** (`Notes`)
    - Purpose: Text notes
    - Cascade Delete: Yes

17. **ContactFeed** (`Feeds`)
    - Purpose: Chatter feed posts
    - Cascade Delete: Yes

##### History & Sharing

18. **ContactHistory** (`Histories`)
    - Purpose: Field history tracking
    - Cascade Delete: Yes

19. **ContactShare** (`Shares`)
    - Purpose: Record-level sharing rules
    - Cascade Delete: Yes

##### Change Data Capture & Events

20. **ContactChangeEvent** (Change Events)
    - Purpose: Real-time change notifications for integrations

21. **ContactCleanInfo** (`ContactCleanInfos`)
    - Purpose: Data.com data cleansing information
    - Cascade Delete: Yes

22. **DuplicateRecordItem** (`DuplicateRecordItems`)
    - Purpose: Duplicate detection and management
    - Cascade Delete: Yes

**Full Child Relationship Count**: 89 child relationships

## Field Schema

The Contact object has **62 fields** (standard + custom). Below is the complete field inventory:

### Identity Fields

| API Name | Label | Type | Required | Notes |
|----------|-------|------|----------|-------|
| `Id` | Contact ID | Lookup() | Yes | 18-character unique identifier |
| `IsDeleted` | Deleted | Checkbox | Yes | Soft-delete flag |
| `MasterRecordId` | Contact | Lookup(Contact) | No | Master record after merge |
| `Name` | Name | Name | Yes | Full name (composite of First/Last) |

### Name Components

| API Name | Label | Type | Length | Required | Notes |
|----------|-------|------|--------|----------|-------|
| `Salutation` | Salutation | Picklist | 40 | No | Mr., Ms., Dr., etc. |
| `FirstName` | First Name | Text | 40 | No | Given name |
| `LastName` | Last Name | Text | 80 | Yes | Surname (required) |
| `MiddleName` | Middle Name | Text | 40 | No | Middle name |
| `Suffix` | Suffix | Picklist | 40 | No | Jr., Sr., III, etc. |

### Contact Information

| API Name | Label | Type | Length | Notes |
|----------|-------|------|--------|-------|
| `Email` | Email | Email | 80 | Primary email address |
| `Phone` | Phone | Phone | 40 | Business phone number |
| `MobilePhone` | Mobile | Phone | 40 | Mobile phone number |
| `HomePhone` | Home Phone | Phone | 40 | Home phone number |
| `OtherPhone` | Other Phone | Phone | 40 | Additional phone number |
| `Fax` | Fax | Phone | 40 | Fax number |
| `AssistantName` | Assistant | Text | 40 | Assistant's name |
| `AssistantPhone` | Asst. Phone | Phone | 40 | Assistant's phone |

### Email Deliverability

| API Name | Label | Type | Notes |
|----------|-------|------|-------|
| `IsEmailBounced` | Is Email Bounced | Checkbox | Email bounce flag |
| `EmailBouncedDate` | Email Bounced Date | Date/Time | When email bounced |
| `EmailBouncedReason` | Email Bounced Reason | Text(255) | Bounce reason |

### Address Fields

| API Name | Label | Type | Components |
|----------|-------|------|------------|
| `MailingAddress` | Mailing Address | Address | Street, City, State, Postal Code, Country |
| `OtherAddress` | Other Address | Address | Street, City, State, Postal Code, Country |

**Note**: Each Address compound field breaks down into:
- `MailingStreet` / `OtherStreet`
- `MailingCity` / `OtherCity`
- `MailingState` / `OtherState`
- `MailingPostalCode` / `OtherPostalCode`
- `MailingCountry` / `OtherCountry`
- `MailingGeocodeAccuracy` / `OtherGeocodeAccuracy`
- `MailingLatitude` / `OtherLatitude`
- `MailingLongitude` / `OtherLongitude`

### Professional Information

| API Name | Label | Type | Length | Nullable |
|----------|-------|------|--------|----------|
| `Title` | Title | Text | 128 | Yes |
| `Department` | Department | Text | 80 | Yes |
| `AccountId` | Account Name | Lookup(Account) | 18 | Yes |
| `ReportsToId` | Reports To | Lookup(Contact) | 18 | Yes |

### Personal Information

| API Name | Label | Type | Length | Nullable |
|----------|-------|------|--------|----------|
| `Birthdate` | Birthdate | Date | - | Yes |
| `Description` | Description | Long Text Area | 32,000 | Yes |
| `PhotoUrl` | Photo URL | URL | 255 | Yes |

### Lead Source & Marketing

| API Name | Label | Type | Length | Notes |
|----------|-------|------|--------|-------|
| `LeadSource` | Lead Source | Picklist | 255 | Original lead source |
| `ContactSource` | Creation Source | Picklist | 40 | How contact was created |

### Data Enrichment (Data.com)

| API Name | Label | Type | Length | Notes |
|----------|-------|------|--------|-------|
| `Jigsaw` | Data.com Key | Text | 20 | Legacy Data.com identifier |
| `JigsawContactId` | Jigsaw Contact Id | External Lookup | 20 | Legacy external ID |
| `CleanStatus` | Clean Status | Picklist | 40 | Data quality status |

### Stay-in-Touch

| API Name | Label | Type | Notes |
|----------|-------|------|-------|
| `LastCURequestDate` | Last Stay-in-Touch Request Date | Date/Time | Last SIT request |
| `LastCUUpdateDate` | Last Stay-in-Touch Save Date | Date/Time | Last SIT save |

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

### Ownership

| API Name | Label | Type | Notes |
|----------|-------|------|-------|
| `OwnerId` | Contact Owner | Lookup(User) | Record owner (required) |

### Data Privacy (GDPR)

| API Name | Label | Type | Notes |
|----------|-------|------|-------|
| `IndividualId` | Individual | Lookup(Individual) | Data privacy/consent tracking |

### Access Control

| API Name | Label | Type | Notes |
|----------|-------|------|-------|
| `UserRecordAccessId` | Object Access Level | Lookup(UserRecordAccess) | Current user's access level |

## Custom Fields

This org has **2 custom fields** on the Contact object:

| API Name | Label | Type | Length/Precision | Nullable | Purpose |
|----------|-------|------|------------------|----------|---------|
| `Languages__c` | Languages | Text | 100 | Yes | Languages spoken by contact |
| `Level__c` | Level | Picklist | 255 | Yes | Contact level/seniority |

### Custom Field Analysis

**Languages__c**: Tracks languages spoken by the contact. Useful for:
- International customer support routing
- Marketing campaign targeting
- Sales rep assignment based on language needs
- Format: Likely comma-separated (e.g., "English, Spanish, French")

**Level__c**: Contact level or seniority classification. Likely values:
- Primary / Secondary / Tertiary
- Executive / Manager / Individual Contributor
- Decision Maker / Influencer / End User
- Senior / Mid-Level / Junior

## Picklist Values

To retrieve picklist values for standard and custom fields, use:

```bash
sf data query -o myorg -q "SELECT QualifiedApiName, PicklistValueSetApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'Contact' AND DataType LIKE '%Picklist%'" --json

# Or for specific field values:
sf sobject describe -o myorg -s Contact --json | jq '.result.fields[] | select(.name=="LeadSource") | .picklistValues'
```

Common Picklist Fields:

- **Salutation**: Mr., Ms., Mrs., Dr., Prof.
- **Suffix**: Jr., Sr., II, III, IV, V
- **LeadSource**: Web, Phone Inquiry, Partner Referral, Purchased List, Other, Advertisement, Employee Referral, External Referral, Trade Show
- **ContactSource**: Manual, Data.com, API, Web-to-Case, etc.
- **CleanStatus**: Not Compared, In Sync, Different, Reviewed, Skipped
- **Level__c**: (Custom - org-specific values)

## Page Layouts & UI Configuration

### Compact Layout

Compact layouts control which fields appear in the record highlights panel (top of page) and in hover details.

To retrieve layout details:
```bash
sf data query -o myorg -q "SELECT Id, Name, PrimaryField, SobjectType, (SELECT FieldApiName FROM FieldLayoutItems ORDER BY CreatedDate) FROM CompactLayout WHERE SobjectType = 'Contact'" --json
```

### Page Layouts

Standard layouts likely include:
- **Contact Layout** (default)
- Record type-specific layouts (if record types exist)

To check available layouts:
```bash
sf data query -o myorg -q "SELECT Id, Name FROM Layout WHERE EntityDefinitionId = '003000000000000AAA'" --json
```

### Custom Action Override

The org has a **custom page override** for the Contact View action:
- **Action**: View
- **Form Factor**: LARGE (desktop)
- **Page ID**: `0M01a000000GupRCAS`
- **Type**: Likely Visualforce Page or Lightning Page

This means clicking on a Contact record opens a custom page instead of the standard layout.

## Record Types

To check if Contact has record types:
```bash
sf data query -o myorg -q "SELECT Id, Name, DeveloperName, Description FROM RecordType WHERE SobjectType = 'Contact'" --json
```

Record types enable different page layouts, picklist values, and business processes for different contact types (e.g., "Customer Contact", "Partner Contact", "Vendor Contact").

## Validation Rules & Automation

### Validation Rules

To retrieve validation rules:
```bash
sf data query -o myorg -q "SELECT ValidationName, ErrorMessage, ErrorDisplayField, Active FROM ValidationRule WHERE EntityDefinitionId = 'Contact'" --json
```

Common validation patterns:
- Email format validation
- Required fields for certain contact types
- Phone number format validation
- Age validation (if Birthdate is used)
- Prevent duplicate emails within same account

### Workflow Rules & Process Builder

To check automation:
```bash
sf data query -o myorg -q "SELECT Name, Type FROM WorkflowRule WHERE TableEnumOrId = 'Contact'" --json
```

## Business Use Cases

### 1. Account Relationship Management

Query all contacts for an account:

```sql
-- Get all contacts for an account with roles
SELECT Id, Name, Title, Email, Phone, Account.Name,
       (SELECT Role FROM AccountContactRoles WHERE AccountId = '001xxxxxx')
FROM Contact
WHERE AccountId = '001xxxxxx'
ORDER BY LastName
```

### 2. Organizational Hierarchy

Model reporting structure:

```sql
-- Get direct reports
SELECT Id, Name, Title, Email, ReportsTo.Name
FROM Contact
WHERE ReportsToId = '003xxxxxxxxxxxxxxx'

-- Get full reporting chain
SELECT Id, Name, ReportsTo.Name, ReportsTo.ReportsTo.Name
FROM Contact
WHERE Id = '003xxxxxxxxxxxxxxx'
```

### 3. Contact Segmentation by Level

```sql
SELECT Name, Title, Level__c, Account.Name, Email
FROM Contact
WHERE Level__c = 'Executive'
AND AccountId IN (
    SELECT Id FROM Account WHERE Active__c = 'Yes'
)
ORDER BY Account.Name, LastName
```

### 4. Multi-Language Support

```sql
SELECT Name, Languages__c, Email, MailingCountry
FROM Contact
WHERE Languages__c LIKE '%Spanish%'
OR Languages__c LIKE '%French%'
ORDER BY MailingCountry
```

### 5. Email Deliverability Analysis

```sql
SELECT COUNT(Id) TotalBounced,
       COUNT(DISTINCT AccountId) AffectedAccounts
FROM Contact
WHERE IsEmailBounced = true
AND Email != NULL

-- Get bounced contacts by reason
SELECT EmailBouncedReason, COUNT(Id) Count
FROM Contact
WHERE IsEmailBounced = true
GROUP BY EmailBouncedReason
```

### 6. Activity Tracking

```sql
SELECT Name, Account.Name, LastActivityDate,
       (SELECT Subject, ActivityDate FROM ActivityHistories ORDER BY ActivityDate DESC LIMIT 5),
       (SELECT Subject, ActivityDate FROM OpenActivities)
FROM Contact
WHERE AccountId IN (SELECT Id FROM Account WHERE CustomerPriority__c = 'High')
AND LastActivityDate = LAST_N_DAYS:90
ORDER BY LastActivityDate DESC
```

### 7. Campaign Member Analysis

```sql
SELECT Name, Email,
       (SELECT Campaign.Name, Status, CreatedDate FROM CampaignMembers ORDER BY CreatedDate DESC)
FROM Contact
WHERE Id IN (
    SELECT ContactId FROM CampaignMember WHERE Status = 'Responded'
)
```

### 8. Opportunity Contact Roles

```sql
SELECT Name, Account.Name, Email,
       (SELECT Opportunity.Name, Opportunity.StageName, Role
        FROM OpportunityContactRoles
        WHERE Opportunity.IsClosed = false)
FROM Contact
WHERE Id IN (
    SELECT ContactId FROM OpportunityContactRole
    WHERE IsPrimary = true
)
```

### 9. Birthday/Anniversary Tracking

```sql
SELECT Name, Email, Birthdate, Account.Name, Owner.Name
FROM Contact
WHERE Birthdate = THIS_MONTH
AND Email != NULL
ORDER BY DAY(Birthdate)
```

### 10. Inactive Contacts

```sql
SELECT Name, Account.Name, Email, LastActivityDate, LastModifiedDate
FROM Contact
WHERE LastActivityDate < LAST_N_DAYS:365
OR (LastActivityDate = NULL AND CreatedDate < LAST_N_DAYS:365)
ORDER BY LastActivityDate ASC NULLS FIRST
```

## Integration Patterns

### Change Data Capture

Contact supports **Change Data Capture** via `ContactChangeEvent`. This enables:

- Real-time integration triggers
- Event-driven architectures
- External system sync on field changes

Subscribe to events:
```apex
trigger ContactChangeEventTrigger on ContactChangeEvent (after insert) {
    for (ContactChangeEvent event : Trigger.new) {
        // Process change event
        System.debug('Contact changed: ' + event.changeEventHeader);

        // Check what fields changed
        if (event.ChangeEventHeader.changedFields.contains('Email')) {
            // Email changed - update external system
        }
    }
}
```

### Person Accounts

If Person Accounts are enabled in your org, some contacts are stored as Accounts with `IsPersonAccount = true`. These combine Account and Contact data into a single record.

Query person accounts:
```sql
SELECT Id, FirstName, LastName, PersonEmail, PersonMobilePhone
FROM Account
WHERE IsPersonAccount = true
```

### Data Privacy & GDPR

The `IndividualId` field links to the `Individual` object for data privacy compliance:

```sql
SELECT Name, Email, Individual.HasOptedOutProcessing,
       Individual.HasOptedOutProfiling, Individual.HasOptedOutTracking
FROM Contact
WHERE IndividualId != NULL
```

## Data Quality & Cleansing

### Data.com Integration

Fields for data enrichment:
- `Jigsaw`: Data.com unique identifier
- `JigsawContactId`: External lookup
- `CleanStatus`: Data quality indicator
- `ContactCleanInfo`: Child object with cleansing metadata

### Deduplication

The org supports:
- **Matching Rules** (Email, Name + Account, etc.)
- **Duplicate Rules** for prevention/alerting
- Merge functionality (writes to `MasterRecordId`)

Query duplicates:
```sql
SELECT ContactId, RecordId, DuplicateRecordSetId
FROM DuplicateRecordItem
WHERE RecordId IN (
    SELECT Id FROM Contact
    WHERE Email = 'john.doe@example.com'
)
```

Find potential duplicates:
```sql
-- Contacts with same email
SELECT Email, COUNT(Id) Count,
       MIN(Name) FirstContact, MAX(Name) LastContact
FROM Contact
WHERE Email != NULL
GROUP BY Email
HAVING COUNT(Id) > 1

-- Contacts with same name and account
SELECT AccountId, FirstName, LastName, COUNT(Id) Count
FROM Contact
WHERE AccountId != NULL
GROUP BY AccountId, FirstName, LastName
HAVING COUNT(Id) > 1
```

## Sharing & Security

### Organization-Wide Default (OWD)

Common configurations:
- **Controlled by Parent**: Inherits sharing from Account
- **Private**: Only owner + roles above can see
- **Public Read Only**: All users can view, only owner can edit
- **Public Read/Write**: All users can view and edit

### Sharing Rules

Contact supports:
- **Criteria-based sharing**: Share contacts matching filters
- **Ownership-based sharing**: Share contacts owned by certain users/groups
- **Account-based sharing**: Inherits from Account's sharing rules

### Manual Sharing

Querying shares:
```sql
SELECT ContactId, UserOrGroupId, ContactAccessLevel, RowCause
FROM ContactShare
WHERE ContactId = '003xxxxxxxxxxxxxxx'
```

### Field-Level Security (FLS)

Custom fields may have restricted visibility by profile/permission set. Check FLS:
```bash
sf data query -o myorg -q "SELECT Parent.Name, Field, PermissionsRead, PermissionsEdit FROM FieldPermissions WHERE SobjectType = 'Contact' AND Field LIKE 'Contact.%'" --json
```

## Reporting & Analytics

### Standard Reports

Common Contact report types:
- **Contacts & Accounts**: Contact list with account details
- **Contacts with Opportunities**: Contact involvement in deals
- **Contacts with Activities**: Activity history
- **Contacts with Cases**: Support ticket engagement
- **Campaign Members**: Marketing campaign participation

### Custom Report Types

Create custom report types for:
- Contacts with custom fields (Languages, Level)
- Multi-level reporting hierarchy
- Contact engagement scoring
- GDPR compliance reports

### Dashboard KPIs

Key metrics:
- Total active contacts
- Contacts by level/seniority
- Email deliverability rate
- Contacts without email addresses
- Average contacts per account
- New contacts created (this month/quarter/year)
- Contacts by lead source
- Activity engagement metrics

## Apex & Development

### Triggers

Check for existing triggers:
```bash
sf data query -o myorg -q "SELECT Name, Status, BodyLength FROM ApexTrigger WHERE TableEnumOrId = 'Contact'" --json
```

Common trigger patterns:
- Auto-populate fields from Account
- Duplicate email prevention
- Role-based field validation
- External system callouts on creation/update
- Activity logging

### SOQL Patterns

**Efficient queries with relationships:**
```apex
// Query with account
List<Contact> contacts = [
    SELECT Id, Name, Email, Account.Name, Account.Industry
    FROM Contact
    WHERE AccountId != null
];

// Query with parent contact (ReportsTo)
List<Contact> managers = [
    SELECT Id, Name, Title,
        (SELECT Id, Name, Email FROM DirectReports)
    FROM Contact
    WHERE ReportsToId = null
];

// Query with opportunity roles
List<Contact> dealContacts = [
    SELECT Id, Name, Email,
        (SELECT Opportunity.Name, Role, IsPrimary
         FROM OpportunityContactRoles
         WHERE Opportunity.IsClosed = false)
    FROM Contact
    WHERE AccountId IN :accountIds
];

// Query with activity history
List<Contact> activeContacts = [
    SELECT Id, Name, Email, LastActivityDate,
        (SELECT Subject, ActivityDate
         FROM ActivityHistories
         ORDER BY ActivityDate DESC
         LIMIT 5)
    FROM Contact
    WHERE LastActivityDate >= LAST_N_DAYS:30
];
```

### Apex Field Access

```apex
Contact con = new Contact();
con.FirstName = 'Jane';
con.LastName = 'Doe';
con.Email = 'jane.doe@example.com';
con.Phone = '555-0100';
con.AccountId = '001xxxxxxxxxxxxxxx';
con.Title = 'VP of Engineering';
con.Department = 'Engineering';
con.Languages__c = 'English, Spanish';
con.Level__c = 'Executive';
insert con;
```

### Bulk Operations

```apex
// Bulk update contact owners
List<Contact> contactsToUpdate = new List<Contact>();
for (Contact c : [SELECT Id, OwnerId, AccountId FROM Contact WHERE AccountId IN :accountIds]) {
    c.OwnerId = accountOwnerMap.get(c.AccountId);
    contactsToUpdate.add(c);
}
update contactsToUpdate;
```

## API Access

### REST API

**Get Contact by ID:**
```bash
curl https://yourinstance.salesforce.com/services/data/v65.0/sobjects/Contact/003xxxxxx \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Query Contacts:**
```bash
curl "https://yourinstance.salesforce.com/services/data/v65.0/query?q=SELECT+Name,Email+FROM+Contact+WHERE+Level__c='Executive'" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Create Contact:**
```bash
curl https://yourinstance.salesforce.com/services/data/v65.0/sobjects/Contact \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "FirstName": "Jane",
    "LastName": "Doe",
    "Email": "jane.doe@example.com",
    "AccountId": "001xxxxxxxxxxxxxxx",
    "Languages__c": "English, French",
    "Level__c": "Executive"
  }'
```

**Update Contact:**
```bash
curl -X PATCH https://yourinstance.salesforce.com/services/data/v65.0/sobjects/Contact/003xxxxxx \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "Email": "jane.new@example.com",
    "Phone": "555-0200"
  }'
```

### SOAP API

Contact supports full SOAP API operations:
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
sf data upsert bulk -o myorg -s Contact -f contacts.csv -i Email
```

## Performance Considerations

### Indexing

Salesforce automatically indexes:
- `Id`
- `Name` (LastName)
- `OwnerId`
- `AccountId`
- `Email`
- `CreatedDate`
- `SystemModstamp`
- Lookup fields (`ReportsToId`, `IndividualId`)
- External ID fields

Custom indexes can be requested for:
- High-query-volume custom fields (`Languages__c`, `Level__c`)
- Filter fields in list views/reports

### Query Optimization

**Bad:**
```sql
-- Avoid LIKE wildcards at start
SELECT Id FROM Contact WHERE Name LIKE '%Doe'

-- Avoid querying large text fields
SELECT Description FROM Contact WHERE Level__c = 'Executive'

-- Non-selective queries
SELECT Id FROM Contact WHERE Birthdate != NULL
```

**Good:**
```sql
-- Use indexed fields in WHERE
SELECT Id FROM Contact WHERE Email = 'jane.doe@example.com'

-- Limit fields returned
SELECT Id, Name, Email FROM Contact WHERE AccountId = '001xxxxxx'

-- Use LIMIT
SELECT Id, Name FROM Contact WHERE Level__c = 'Executive' LIMIT 100

-- Use AccountId (indexed) for account-specific queries
SELECT Id, Name FROM Contact WHERE AccountId IN :accountIds
```

### Large Data Volumes (LDV)

If Contact exceeds 1 million records:
- Enable **skinny tables** for frequently queried fields
- Use **Selective SOQL** (filter on indexed fields)
- Leverage **Bulk API** for mass operations
- Consider **Data Archival** for old inactive contacts
- Implement **Custom Indexing** on frequently filtered fields

### Query Governor Limits

Be aware of governor limits:
- SOQL queries: 100 per transaction (synchronous), 200 (asynchronous)
- Records retrieved: 50,000 per transaction
- DML statements: 150 per transaction
- DML rows: 10,000 per transaction

## Testing & Deployment

### Apex Tests

When deploying changes to Contact:
- Test trigger coverage (75%+ required)
- Test with System.runAs() for sharing rules
- Test bulk scenarios (200+ records)
- Test governor limits
- Test email validation logic
- Test duplicate handling

Example:
```apex
@isTest
private class ContactTriggerTest {
    @isTest
    static void testContactCreation() {
        Account acc = new Account(Name = 'Test Account');
        insert acc;

        Contact con = new Contact(
            FirstName = 'Jane',
            LastName = 'Doe',
            Email = 'jane.doe@test.com',
            AccountId = acc.Id,
            Languages__c = 'English',
            Level__c = 'Executive'
        );

        Test.startTest();
        insert con;
        Test.stopTest();

        Contact result = [SELECT Id, Name, Account.Name FROM Contact WHERE Id = :con.Id];
        System.assertEquals('Jane Doe', result.Name);
        System.assertEquals('Test Account', result.Account.Name);
    }

    @isTest
    static void testBulkContactInsert() {
        Account acc = new Account(Name = 'Bulk Test Account');
        insert acc;

        List<Contact> contacts = new List<Contact>();
        for (Integer i = 0; i < 200; i++) {
            contacts.add(new Contact(
                FirstName = 'Test',
                LastName = 'Contact ' + i,
                Email = 'test' + i + '@example.com',
                AccountId = acc.Id
            ));
        }

        Test.startTest();
        insert contacts;
        Test.stopTest();

        System.assertEquals(200, [SELECT COUNT() FROM Contact WHERE AccountId = :acc.Id]);
    }
}
```

### Deployment Checklist

When deploying Contact customizations:

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
- [ ] Email templates (for contact notifications)

### Migration Commands

```bash
# Retrieve Contact metadata
sf project retrieve start -o myorg -m "CustomObject:Contact"

# Deploy to target org
sf project deploy start -o targetorg -m "CustomObject:Contact"

# Retrieve specific components
sf project retrieve start -o myorg -m "CustomField:Contact.Languages__c,CustomField:Contact.Level__c,Layout:Contact-Contact Layout"
```

## Monitoring & Maintenance

### Field Usage Analysis

Identify unused fields:
```bash
# Check if custom fields are populated
sf data query -o myorg -q "SELECT COUNT(Id) FROM Contact WHERE Languages__c != null" --json
sf data query -o myorg -q "SELECT COUNT(Id) FROM Contact WHERE Level__c != null" --json
```

### Storage Impact

Contact records consume:
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
FROM ContactHistory
WHERE ContactId = '003xxxxxxxxxxxxxxx'
ORDER BY CreatedDate DESC
```

### Data Quality Monitoring

```sql
-- Contacts without email
SELECT COUNT(Id) FROM Contact WHERE Email = NULL

-- Contacts without account
SELECT COUNT(Id) FROM Contact WHERE AccountId = NULL

-- Bounced emails
SELECT COUNT(Id) FROM Contact WHERE IsEmailBounced = true

-- Contacts without phone
SELECT COUNT(Id) FROM Contact WHERE Phone = NULL AND MobilePhone = NULL

-- Inactive contacts (no activity in 1 year)
SELECT COUNT(Id) FROM Contact WHERE LastActivityDate < LAST_N_DAYS:365
```

## Common Customization Patterns

### 1. Duplicate Email Prevention

Use validation rule or trigger to prevent duplicate emails within same account:

**Validation Rule:**
```
AND(
  NOT(ISBLANK(Email)),
  AccountId != NULL,
  VLOOKUP(
    $ObjectType.Contact.Fields.Email,
    $ObjectType.Contact.Fields.Email,
    Email
  ) != Id
)
```

### 2. Auto-Populate Fields from Account

Use Process Builder/Flow to copy Account fields:
- Copy `Account.Industry` → `Contact.Department` (if empty)
- Copy `Account.Phone` → `Contact.Phone` (if empty)
- Copy `Account.BillingAddress` → `Contact.MailingAddress` (if empty)

### 3. Contact Role Auto-Assignment

Create flow to automatically create `AccountContactRole` when Contact is created:
- Primary contact gets "Decision Maker" role
- Executive level gets "Economic Buyer" role
- Others get "Business User" role

### 4. Email Bounce Handling

Create scheduled flow/Apex to:
- Flag contacts with bounced emails
- Send alerts to owners
- Auto-update `CleanStatus`
- Create task for data verification

### 5. Language-Based Assignment

Auto-assign Contact owner based on `Languages__c`:
- If contains "Spanish" → assign to Spanish-speaking rep
- If contains "French" → assign to French-speaking rep
- Round-robin within language groups

### 6. Birthday/Anniversary Notifications

Create scheduled flow to:
- Query contacts with birthdays in next 7 days
- Send email to owner
- Create task for outreach
- Optionally send automated birthday email

### 7. Level-Based Escalation

Auto-escalate engagement for executive-level contacts:
- Send alert to manager when executive-level contact is created
- Auto-create high-priority task
- Add to executive nurture campaign

### 8. Contact Hierarchy Validation

Prevent circular reporting structures:
```apex
trigger ContactHierarchyValidation on Contact (before insert, before update) {
    for (Contact con : Trigger.new) {
        if (con.ReportsToId != null) {
            // Validate no circular reference
            Set<Id> visited = new Set<Id>();
            Id currentId = con.ReportsToId;

            while (currentId != null && !visited.contains(currentId)) {
                if (currentId == con.Id) {
                    con.addError('Cannot create circular reporting structure');
                    break;
                }
                visited.add(currentId);
                // Check next level up
                Contact parent = [SELECT ReportsToId FROM Contact WHERE Id = :currentId LIMIT 1];
                currentId = parent.ReportsToId;
            }
        }
    }
}
```

## Related Objects

### Objects That Reference Contact

- **Opportunity**: `ContactId` (primary contact)
- **OpportunityContactRole**: `ContactId` (multiple roles)
- **Case**: `ContactId`
- **AccountContactRole**: `ContactId`
- **Asset**: `ContactId`
- **Contract**: `CustomerSignedId`
- **Lead**: `ConvertedContactId` (after conversion)
- **Task/Event**: `WhoId` (polymorphic)
- **EmailMessage**: `RelatedToId`
- **CampaignMember**: `ContactId`

### Objects Referenced by Contact

- **Account**: `AccountId`
- **Contact**: `ReportsToId` (self-referencing hierarchy)
- **Individual**: `IndividualId` (data privacy)
- **User**: `OwnerId`

## Troubleshooting

### Common Errors

1. **REQUIRED_FIELD_MISSING**
   - Missing: `LastName` (required)
   - Solution: Always provide Contact last name

2. **DUPLICATE_VALUE**
   - Duplicate rule triggered (e.g., duplicate email)
   - Solution: Check existing records, handle duplicates

3. **INVALID_EMAIL_ADDRESS**
   - Invalid email format
   - Solution: Validate email format before insert/update

4. **UNABLE_TO_LOCK_ROW**
   - Concurrent updates
   - Solution: Implement retry logic in integration

5. **FIELD_CUSTOM_VALIDATION_EXCEPTION**
   - Validation rule failed
   - Solution: Check validation rules, ensure data meets criteria

6. **INSUFFICIENT_ACCESS_OR_READONLY**
   - Sharing rule / FLS issue
   - Solution: Grant object-level or field-level access

7. **INVALID_CROSS_REFERENCE_KEY**
   - Referenced Account or ReportsTo Contact doesn't exist
   - Solution: Verify related records exist before linking

### Debug Queries

```sql
-- Find contacts without owner
SELECT Id, Name FROM Contact WHERE OwnerId = null

-- Find orphaned contacts (account deleted)
SELECT Id, Name, AccountId FROM Contact
WHERE AccountId != null
AND AccountId NOT IN (SELECT Id FROM Account)

-- Find circular reporting structures
SELECT Id, Name, ReportsToId, ReportsTo.Name FROM Contact
WHERE ReportsToId != null

-- Contacts with invalid emails
SELECT Id, Name, Email FROM Contact
WHERE Email != null
AND IsEmailBounced = true

-- Contacts without activities
SELECT Id, Name, LastActivityDate FROM Contact
WHERE LastActivityDate = null
AND CreatedDate < LAST_N_DAYS:90
```

## Additional Resources

### Salesforce Documentation

- [Contact Object Reference](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_contact.htm)
- [Person Accounts](https://help.salesforce.com/articleView?id=sf.account_person.htm)
- [Contact Sharing](https://help.salesforce.com/articleView?id=sf.sharing_contacts.htm)
- [Data Privacy and GDPR](https://help.salesforce.com/articleView?id=sf.data_protection_and_privacy.htm)

### Trailhead Modules

- [Contact Management](https://trailhead.salesforce.com/content/learn/modules/contact-management)
- [Accounts & Contacts for Lightning Experience](https://trailhead.salesforce.com/content/learn/modules/accounts_contacts_lightning_experience)
- [Data Security](https://trailhead.salesforce.com/content/learn/modules/data_security)

### Schema Exploration Commands

```bash
# Full object describe
sf sobject describe -o myorg -s Contact --json > contact-describe.json

# Field definitions query
sf data query -o myorg -q "SELECT QualifiedApiName, Label, DataType FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'Contact'" --json > contact-fields.json

# Picklist values
sf data query -o myorg -q "SELECT QualifiedApiName, Label, IsActive FROM PicklistValueInfo WHERE EntityParticle.EntityDefinition.QualifiedApiName = 'Contact'" --json

# Relationship info
sf data query -o myorg -q "SELECT QualifiedApiName, RelationshipName, ReferenceTo FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'Contact' AND DataType LIKE '%Lookup%'" --json

# Check custom fields
sf data query -o myorg -q "SELECT QualifiedApiName, Label, DataType FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'Contact' AND IsCustom = true" --json
```

## Org-Specific Configuration Summary

Based on the retrieved metadata for **your Salesforce org** (user@example.com):

- **Custom Fields**: 2 (Languages, Level)
- **View Action Override**: Custom page (ID: 0M01a000000GupRCAS)
- **Data Enrichment**: Data.com fields present
- **Hierarchy Enabled**: Yes (`ReportsToId` field for org chart)
- **Feed Enabled**: Yes (Chatter)
- **History Tracking**: Yes (`ContactHistory` child)
- **Change Events**: Yes (`ContactChangeEvent`)
- **GDPR Support**: Yes (`IndividualId` field)
- **Email Bounce Tracking**: Yes (3 email bounce fields)

### Next Steps for Analysis

1. **Retrieve full metadata package**:
   ```bash
   sf project retrieve start -o myorg -m "CustomObject:Contact"
   ```

2. **Analyze page layouts**:
   ```bash
   sf data query -o myorg -q "SELECT Id, Name FROM Layout WHERE EntityDefinitionId = '003000000000000AAA'" --json
   ```

3. **Check validation rules**:
   ```bash
   sf data query -o myorg -q "SELECT ValidationName, Active, ErrorMessage FROM ValidationRule WHERE EntityDefinitionId = 'Contact'" --json
   ```

4. **Review triggers and classes**:
   ```bash
   sf data query -o myorg -q "SELECT Name, Status FROM ApexTrigger WHERE TableEnumOrId = 'Contact'" --json
   ```

5. **Export sample data**:
   ```bash
   sf data export tree -o myorg -q "SELECT FIELDS(ALL) FROM Contact LIMIT 10" -x -d ./data
   ```

6. **Analyze picklist values**:
   ```bash
   sf data query -o myorg -q "SELECT PicklistFieldApiName, Value, Label FROM PicklistValueInfo WHERE EntityParticle.QualifiedApiName IN ('Contact.Level__c', 'Contact.LeadSource')" --json
   ```

---

**Document Generated**: 2025-10-13
**Salesforce Org**: user@example.com
**Org ID**: 00D1a000000HIpGEAW
**API Version**: v65.0

**Data Sources**:
- `sf sobject describe` (89 child relationships, 62 fields)
- `sf data query` FieldDefinition (44 queryable fields)
- Retrieved manifest (`allMetadata.xml`)

**File Locations**:
- Object describe: `/tmp/contact-describe.json`
- Field definitions: `/tmp/contact-fields.json`
