# Salesforce Core Entities — Reference

A concise guide to the standard Salesforce objects that zcrm models, and how they map to the vault.

## Core CRM

| Object | Purpose | zcrm Directory | ID Prefix |
|--------|---------|----------------|-----------|
| **Account** | Companies/households | `accounts/` | `acc_` |
| **Contact** | People at accounts | `contacts/` | `con_` |
| **Lead** | Unqualified person/company | `leads/` | `led_` |
| **Opportunity** | Potential deal with stages & amount | `opportunities/` | `opp_` |

## Sales Process

| Object | Purpose | zcrm Directory | ID Prefix |
|--------|---------|----------------|-----------|
| **Campaign** | Marketing initiative | `campaigns/` | `cmp_` |
| **Product** | Sellable item/service | `products/` | `prd_` |
| **OpportunityLineItem** | Products on an opportunity | `line-items/` | `oli_` |
| **Quote** | Price proposal | `quotes/` | `quo_` |
| **QuoteLineItem** | Products on a quote | `quote-lines/` | `qli_` |
| **Order** | Confirmed purchase | `orders/` | `ord_` |
| **Contract** | Formal agreement | `contracts/` | `ctr_` |
| **Asset** | Customer-owned item | `assets/` | `ast_` |

## Service

| Object | Purpose | zcrm Directory | ID Prefix |
|--------|---------|----------------|-----------|
| **Case** | Support ticket | `cases/` | `cas_` |
| **Knowledge** | Support articles/FAQs | `knowledge/` | `kav_` |

## Activities

| Object | Purpose | zcrm Directory | ID Prefix |
|--------|---------|----------------|-----------|
| **Task** | To-do items | `tasks/` | `tsk_` |
| **Event** | Meetings/appointments | `events/` | `evt_` |
| **Activity** | Meetings, calls, notes | `activities/` | `act_` |

## Key Relationships

```
Account ──has many──→ Contacts
Account ──has many──→ Opportunities
Opportunity ──has many──→ Line Items (Products)
Opportunity ──has many──→ Quotes
Lead ──converts to──→ Account + Contact + Opportunity
Campaign ──has many──→ Campaign Members (Leads/Contacts)
Account ──has many──→ Cases, Assets, Contracts, Orders
```

## Party Model (Extended)

zcrm extends the Salesforce model with a Party entity for unified identity:

| Object | Purpose | Directory | ID Prefix |
|--------|---------|-----------|-----------|
| **Party** | Universal entity | `parties/` | `pty_` |
| **Individual** | Person details | `individuals/` | `ind_` |
| **Organization** | Company details | `organizations/` | `org_` |
| **Household** | Household grouping | `households/` | `hsh_` |
| **ResearcherProfile** | Academic intelligence hub | `researcher-profiles/` | `rsp_` |
| **OrganizationProfile** | Company intelligence hub | `organization-profiles/` | `orp_` |

## Contact Points

| Object | Purpose | Directory | ID Prefix |
|--------|---------|-----------|-----------|
| **ContactPointEmail** | Email address | `contact-point-emails/` | `cpe_` |
| **ContactPointPhone** | Phone number | `contact-point-phones/` | `cpp_` |
| **ContactPointAddress** | Physical address | `contact-point-addresses/` | `cpa_` |
| **ContactPointConsent** | GDPR consent record | `contact-point-consents/` | `cpc_` |

## Learning Order

1. **Account, Contact, Lead, Opportunity** — core CRM
2. **Task, Event, Campaign** — activities & marketing
3. **Product, Quote, Order** — sales process
4. **Case, Knowledge** — service
5. **Party, Individual, Organization** — unified identity model
