# Pocketz Improvement Ideas

Based on current output: `2025-10-15_182849_trailheadsalesforcecom_get-started-with-agentforce-service-agent`

## Naming Improvements

### Problem: Domain Names Lose Readability

**Current**: `trailheadsalesforcecom` (all dots removed, hard to read)

**Options**:

1. **Keep dots in domain** (simple)
   - `2025-10-15_182849_trailhead.salesforce.com_get-started-with-agentforce`
   - Pros: Readable, clear source
   - Cons: Dots in filenames can be confusing

2. **Use dashes for dots** (recommended)
   - `2025-10-15_182849_trailhead-salesforce-com_get-started-with-agentforce`
   - Pros: Very readable, filesystem-safe
   - Cons: None really

3. **Abbreviate known domains**
   - Map: `trailhead.salesforce.com` → `sfdc-trailhead`
   - `2025-10-15_182849_sfdc-trailhead_get-started-with-agentforce`
   - Pros: Shorter, cleaner
   - Cons: Need to maintain mapping list

### Problem: Article IDs Too Long

**Current**: `get-started-with-agentforce-service-agent` (45 chars)

**Options**:

1. **Truncate with hash** (recommended)
   - `2025-10-15_182849_trailhead-salesforce-com_get-started-with-agentf_a1b2c`
   - Keep first 30 chars + short hash of full URL
   - Pros: Guaranteed unique, still readable
   - Cons: Slight complexity

2. **Just truncate**
   - `2025-10-15_182849_trailhead-salesforce-com_get-started-with-agent`
   - Pros: Simple
   - Cons: Might not be unique

3. **Smart truncation** (keep meaningful parts)
   - Identify key words: "agentforce", "service", "agent"
   - `2025-10-15_182849_trailhead-salesforce-com_agentforce-service-agent`
   - Pros: More meaningful
   - Cons: Complex logic

### Alternative Naming Schemes

1. **Content-type prefix**
   ```
   article_2025-10-15_182849_sfdc-trailhead_agentforce
   video_2025-10-15_183012_youtube_dQw4w9WgXcQ
   paper_2025-10-15_183045_nature_s41467-025-62755-1
   code_2025-10-15_183112_github_anthropics_claude-code
   ```

2. **Hierarchical organization**
   ```
   2025-10-15/
   ├── 182849_sfdc-trailhead_agentforce/
   ├── 183012_youtube_tutorial/
   └── 183045_nature_protein-study/
   ```
   - Group by date folders
   - Shorter individual names

3. **Hash-based with metadata file**
   ```
   a1b2c3d4/
   ├── index.md (contains full URL, title, date)
   ├── content files...
   ```
   - Pros: No naming conflicts ever
   - Cons: Directories not human-readable

## Content Saving Improvements

### Current Issues

1. **Page text truncation** - We truncate at 100KB
2. **No structured metadata** - Missing tags, categories, author info
3. **No full HTML preservation** - Just downloading, not cleaning
4. **Asset organization** - Everything in `/assets/`, no sub-organization

### Metadata Enhancements

**Add to index.md:**

```markdown
---
url: https://trailhead.salesforce.com/...
title: Get Started with Agentforce Service Agent
captured: 2025-10-15T18:28:49Z
domain: trailhead.salesforce.com
type: tutorial
tags: [agentforce, salesforce, service, ai]
author: Salesforce
word_count: 2547
has_pdf: true
has_video: false
---

# Get Started with Agentforce Service Agent

[content...]
```

**Benefits**:
- Searchable YAML frontmatter
- Obsidian dataview queries
- Better organization

### Content Type Detection

Auto-detect and save differently:

1. **Academic Papers**
   - Extract: Authors, abstract, citations, DOI
   - Save: Full PDF + structured metadata
   - Extra: BibTeX citation file

2. **Blog Posts/Articles**
   - Extract: Author, publish date, tags
   - Save: Cleaned HTML + markdown
   - Extra: Reading time estimate

3. **Video Tutorials**
   - Extract: Duration, channel, transcript (if available)
   - Save: Thumbnail, description, links
   - Extra: Auto-generated chapter markers

4. **Code Repositories**
   - Extract: Stars, language, contributors, README
   - Save: Clone or download ZIP
   - Extra: Dependency list

5. **Documentation**
   - Extract: Version, API references
   - Save: Entire doc tree if multi-page
   - Extra: Searchable index

### Better HTML Archiving

Instead of raw HTML download:

1. **Use readability/mozilla-readability**
   - Extract just the article content
   - Remove ads, navigation, footer
   - Cleaner markdown conversion

2. **Save multiple formats**
   ```
   directory/
   ├── original.html     # Full page
   ├── readable.html     # Cleaned version
   ├── content.md        # Markdown conversion
   └── assets/
   ```

3. **Screenshot capture**
   - Full page screenshot
   - Useful for design/layout reference
   - Archive visual appearance

### Asset Organization

Instead of flat `/assets/`:

```
directory/
├── index.md
├── content.html
├── media/
│   ├── images/
│   │   ├── hero.jpg
│   │   └── diagram.png
│   ├── videos/
│   │   └── demo.mp4
│   └── pdfs/
│       └── supplemental.pdf
└── code/
    ├── styles.css
    └── scripts.js
```

## Search and Discovery

### Tagging System

Auto-tag based on:
- Domain (salesforce, nature, github, etc.)
- Content type (article, paper, video, code)
- Detected topics (AI, biology, javascript, etc.)

### Full-Text Search

Options:
1. **Use Obsidian search** (already works)
2. **Generate search index** (JSON file with all content)
3. **SQLite FTS** (full-text search database)

### Collections/Categories

Allow grouping saves:
```
collections/
├── machine-learning.md  # Links to all ML-related saves
├── biology-papers.md    # All bio papers
└── tutorials.md         # All tutorial content
```

Auto-update collections based on tags.

## Smart Deduplication

### Problem: Re-saving same content

**Solutions**:

1. **URL hash check**
   - Keep mapping: URL → directory
   - Before saving, check if URL already captured
   - Offer: skip, update, or save new version

2. **Content hash**
   - Hash the actual content
   - Detect if content changed
   - Save only if different

3. **Version tracking**
   ```
   article-name/
   ├── 2025-10-15_182849/  # First capture
   ├── 2025-10-16_093012/  # Updated version
   └── latest -> 2025-10-16_093012/
   ```

## Extension Improvements

### Better Feedback

Instead of silent capture:

1. **Visual notification**
   - Show toast: "Capturing page..."
   - Show completion: "Saved to: directory-name"
   - Show errors: "Failed: reason"

2. **Capture preview**
   - Small popup showing what will be captured
   - List of assets found
   - Estimated download size

3. **Options/settings page**
   - Configure save locations
   - Choose what to capture (text only, full page, PDFs, etc.)
   - Set custom tags

### Selective Capture

Let user choose:
- [ ] Page text
- [ ] Full HTML
- [ ] Images
- [ ] CSS/JS
- [ ] PDFs
- [ ] Videos
- [ ] Screenshots

### Annotation Support

**During capture**:
- Add quick note: "Why I'm saving this"
- Add custom tags
- Set priority/importance

**After capture**:
- Highlight text passages (save selections)
- Add margin notes
- Create flashcards from content

## Server Enhancements

### Web UI Dashboard

Simple web interface at `localhost:6767`:

```
┌─────────────────────────────────────┐
│  Pocketz Archive                    │
├─────────────────────────────────────┤
│  Recent Saves                       │
│  ○ Agentforce Tutorial (2m ago)     │
│  ○ Nature Paper on... (1h ago)      │
│  ○ GitHub Repo: claude... (3h ago)  │
├─────────────────────────────────────┤
│  Search: [__________________] 🔍    │
├─────────────────────────────────────┤
│  Stats:                             │
│  📄 1,247 pages saved               │
│  📊 3.2 GB total                    │
│  📚 45 PDFs                         │
└─────────────────────────────────────┘
```

Features:
- Browse all saves
- Search content
- Re-organize/tag
- Delete unwanted saves
- Export collections

### API Enhancements

**New endpoints**:

```
GET  /saves              # List all saves
GET  /saves/:id          # Get specific save
POST /saves/:id/tags     # Add tags
GET  /search?q=query     # Search content
GET  /stats              # Usage statistics
DELETE /saves/:id        # Delete save
```

### Background Processing

Instead of synchronous:

1. **Queue system**
   - Extension sends URL
   - Server queues for processing
   - Returns immediately
   - Processes in background

2. **Post-processing**
   - Generate thumbnails
   - Extract metadata
   - Run readability
   - Create search index
   - Detect duplicates

### Export Options

Export entire archive or selections:

- **ZIP archive** - All files, ready to move
- **Markdown bundle** - Just markdown files
- **JSON export** - Metadata and content
- **HTML index** - Browsable offline archive
- **Obsidian vault** - Ready to import

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. ✅ Fix domain naming (use dashes instead of removing dots)
2. ✅ Truncate long article IDs intelligently (30 chars + hash)
3. ✅ Add basic metadata to index.md (YAML frontmatter)
4. ✅ Better asset organization (images/, pdfs/, etc.)

### Phase 2: Content Quality (3-5 days)
1. Integrate readability extraction
2. Add content type detection
3. Auto-tagging system
4. Better markdown conversion
5. Screenshot capture

### Phase 3: User Experience (1 week)
1. Extension visual feedback
2. Options/settings page
3. Simple web dashboard
4. Search functionality
5. Deduplication check

### Phase 4: Advanced Features (2+ weeks)
1. Collections/categories
2. Annotation support
3. Full-text search index
4. Version tracking
5. Export tools

## Configuration Ideas

**New env vars**:

```bash
# Naming
POCKETZ_DOMAIN_STYLE=dashes  # dashes, dots, abbreviated
POCKETZ_MAX_NAME_LENGTH=60
POCKETZ_ADD_HASH=true

# Content
POCKETZ_SAVE_SCREENSHOTS=true
POCKETZ_USE_READABILITY=true
POCKETZ_AUTO_TAG=true
POCKETZ_MAX_CONTENT_SIZE=10485760  # 10MB

# Features
POCKETZ_CHECK_DUPLICATES=true
POCKETZ_WEB_UI_ENABLED=true
POCKETZ_WEB_UI_PORT=6768
```

## Example: Improved Save

**Before**:
```
2025-10-15_182849_trailheadsalesforcecom_get-started-with-agentforce-service-agent/
├── 2025-10-15_182849_trailheadsalesforcecom_get-started-with-agentforce-service-agent.md
├── Get_Started_with_Agentforce.html
└── assets/
    ├── image1.jpg
    └── style.css
```

**After**:
```
2025-10-15_182849_trailhead-salesforce-com_agentforce-guide_a1b2c/
├── index.md                    # With full YAML frontmatter
├── content/
│   ├── original.html          # Full page
│   ├── readable.html          # Cleaned version
│   ├── article.md             # Markdown conversion
│   └── screenshot.png         # Full page capture
├── media/
│   ├── images/
│   │   ├── hero-banner.jpg
│   │   └── tutorial-diagram.png
│   └── pdfs/
│       └── agentforce-overview.pdf
├── code/
│   ├── main.css
│   └── analytics.js
└── .metadata.json             # Structured metadata for indexing
```

**index.md with metadata**:
```markdown
---
url: https://trailhead.salesforce.com/content/learn/modules/get-started-with-agentforce-service-agent
title: Get Started with Agentforce Service Agent
captured: 2025-10-15T18:28:49Z
domain: trailhead.salesforce.com
short_domain: sfdc-trailhead
type: tutorial
category: documentation
tags: [agentforce, salesforce, service, ai, automation]
author: Salesforce Trailhead
language: en
word_count: 2547
reading_time: 11 minutes
has_pdf: true
has_video: false
has_code: true
content_hash: a1b2c3d4e5f6
duplicate_of: null
related_saves: []
---

# Get Started with Agentforce Service Agent

**Captured from:** [trailhead.salesforce.com](https://trailhead.salesforce.com/...)

**Reading time:** ~11 minutes

---

[Clean, readable content here...]
```

This gives you:
- ✅ Better organization
- ✅ Searchable metadata
- ✅ Multiple content formats
- ✅ Deduplication tracking
- ✅ Related content linking
- ✅ Better Obsidian integration
