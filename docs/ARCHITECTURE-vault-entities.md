# Architecture: Vault Entity Relationships

## Overview

The vault is a **knowledge graph** where:
- **Nodes** = Markdown files (one per entity)
- **Edges** = `[[wiki-links]]` (bidirectional via Obsidian backlinks)
- **Attributes** = YAML frontmatter (structured data)
- **Content** = Markdown body (human-readable context)
- **Queries** = Dataview (SQL-like) or full-text search
- **Visualization** = Graph view (automatic)
- **Version control** = Git (automatic)

Every data source has its own directory. Every entity is self-contained. Every link is explicit and navigable. Every change is git-tracked.

## Entity Categories

### CRM Core Entities (User-Managed)

| Entity Type | Directory | ID Prefix | Purpose |
|-------------|-----------|-----------|---------|
| Party | `parties/` | `pty_` | Universal entity (person, org, household) |
| Individual | `individuals/` | `ind_` | Person-specific data |
| Organization | `organizations/` | `org_` | Company/institution data |
| Account | `accounts/` | `acc_` | Company records |
| Contact | `contacts/` | `con_` | People at accounts |
| Opportunity | `opportunities/` | `opp_` | Sales deals |
| Lead | `leads/` | `led_` | Prospective customers |
| Activity | `activities/` | `act_` | Meetings, calls, notes |
| Task | `tasks/` | `tsk_` | To-do items |
| Campaign | `campaigns/` | `cmp_` | Marketing campaigns |
| Quote | `quotes/` | `quo_` | Price quotes |
| Order | `orders/` | `ord_` | Customer orders |
| Contract | `contracts/` | `ctr_` | Legal agreements |
| Event | `events/` | `evt_` | Calendar events |
| Case | `cases/` | `cas_` | Support cases |
| Product | `products/` | `prd_` | Catalog items |
| Asset | `assets/` | `ast_` | Purchased products |
| Knowledge | `knowledge/` | `kav_` | KB articles |

### Contact Points

| Entity Type | Directory | ID Prefix |
|-------------|-----------|-----------|
| Contact Point Email | `contact-point-emails/` | `cpe_` |
| Contact Point Phone | `contact-point-phones/` | `cpp_` |
| Contact Point Address | `contact-point-addresses/` | `cpa_` |
| Contact Point Consent | `contact-point-consents/` | `cpc_` |

### External Data Sources (Read-Only Imports)

| Entity Type | Directory | ID Prefix | Source |
|-------------|-----------|-----------|--------|
| ORCID Profile | `orcid-profiles/` | `orc_` | ORCID Public API |
| Scholar | `scholars/` | `sch_` | Google Scholar |
| GitHub Profile | `github-profiles/` | `ghp_` | GitHub API |
| Semantic Scholar | `semantic-scholar/` | `ssc_` | Semantic Scholar API |
| NIH Grant | `nih-grants/` | `nih_` | NIH RePORTER API |
| Clinical Trial | `clinical-trials/` | `clt_` | ClinicalTrials.gov |

## Entity Relationship Model

```
                    ┌──────────────┐
                    │    PARTY     │
                    │  (Universal) │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
     │ INDIVIDUAL  │ │ORGANIZATION│ │ HOUSEHOLD  │
     └──────┬──────┘ └────┬──────┘ └────────────┘
            │             │
            ▼             │
  ┌──────────────────┐    │
  │ RESEARCHER       │    │
  │ PROFILE          │    │
  │ (Intelligence    │    │
  │    Hub)          │    │
  └──────┬───────────┘    │
         │                │
         │  Links to:     │
         ├── ORCID        │
         ├── Scholar      │
         ├── GitHub       │
         ├── NIH Grants   │
         └── Conferences  │
                          │
         ORGANIZATION PROFILE
         (Intelligence Hub)
```

## Link Patterns

### Pattern 1: ResearcherProfile as Hub

Links all researcher-related data sources together:

```yaml
# researcher-profiles/roshan-rao-researcher-profile.md
---
party_id: '[[parties/roshan-rao]]'
individual_id: '[[individuals/roshan-rao]]'
orcid_profile: '[[orcid-profiles/roshan-rao]]'
scholar_profile: '[[scholars/roshan-rao]]'
github_profile: '[[github-profiles/rmrao]]'
current_institution: '[[organizations/evolutionaryscale]]'
nih_grants:
  - '[[nih-grants/r01-gm123456]]'
---
```

Obsidian automatically tracks backlinks — all linked entities show this researcher in their backlinks panel.

### Pattern 2: Cross-Source Links

Data sources link to each other via shared identifiers (ORCID ID, email, GitHub username):

```yaml
# scholars/roshan-rao.md
---
orcid_id: 0000-0001-2345-6789
orcid_profile: '[[orcid-profiles/roshan-rao]]'
---
```

### Pattern 3: Party Hierarchy

```yaml
# Party → Individual → ResearcherProfile
party_id: '[[parties/roshan-rao]]'       # Links UP to party
individual_id: '[[individuals/roshan-rao]]'  # Links UP to individual
```

Navigate from Party → see all child entities in backlinks. From Individual → see parent party + sibling profiles.

### Pattern 4: Co-Author Networks

```yaml
related_authors:
  - '[[scholars/alexander-rives]]'
  - '[[scholars/tom-sercu]]'
```

Obsidian Graph View shows the full co-author network as an interconnected graph.

## Entity Resolution

When importing new data sources, entities are linked using:

1. **Exact ID match** — ORCID ID, Scholar ID
2. **Email match** — Shared email addresses
3. **Name + Institution** — Fuzzy name match combined with institutional affiliation
4. **GitHub username** — Cross-platform identity
5. **Publication DOI** — Find co-authors via shared papers

Deduplication checks run before creating new entities to prevent duplicates.

## Obsidian Integration

| Feature | Use Case |
|---------|----------|
| **Graph View** | Visualize co-author networks, funding relationships |
| **Backlinks Panel** | See all entities referencing current entity |
| **Dataview Queries** | SQL-like analytics across all entities |
| **Full-text Search** | Find entities by content, path, or tags |
| **Templates** | Standardize entity creation |
| **Daily Notes** | Track discoveries and link to entities |

### Example Dataview Query

```dataview
TABLE nih_grants
FROM "researcher-profiles"
WHERE length(nih_grants) > 0
```
