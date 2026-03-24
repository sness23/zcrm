# Philosophy: The Helpful Web

## The Problem with Current Web Advertising

The modern web is broken by advertising in fundamental ways:

- **Interruption**: Popups, autoplay videos, overlays that block content
- **Deception**: Ads disguised as content, fake download buttons, dark patterns
- **Privacy invasion**: Tracking pixels, fingerprinting, cross-site surveillance
- **Performance**: Megabytes of ad JavaScript, battery drain, slow page loads
- **Broken economics**: 70% of ad spend goes to ad tech middlemen, not publishers
- **Trust collapse**: 40%+ of users block ads entirely; banner blindness is universal

## Our Premise: Information IS the Ad

What if we started from a different assumption?

Instead of interrupting users to show ads, **generate helpful links based on what the user is reading**.

**Traditional model:**
```
User reads paper → Unrelated ad → User ignores ad → User installs ad blocker
```

**Our model:**
```
User reads paper → AI extracts context → Generate helpful links → User finds exactly what they need
```

### Example: User Reading a Docking Paper

Traditional ads might show a generic lab equipment catalog, an unrelated software banner, or a conference popup.

Our helpful links show:
- AutoDock Vina (mentioned in methods)
- **Schrödinger Suite** (sponsored, better alternative)
- PDB files for the structures analyzed
- Newer versions of the docking software
- *UCSF Chimera* (sponsored distributor)

**Every link serves a purpose.** If it doesn't help, it doesn't appear.

## Core Principles

### 1. Context Over Keywords

Traditional ads match keywords. We use AI to understand **context** and **intent**.

"User reading ML paper using Python" → show relevant libraries, not Python conferences.

### 2. Usefulness Over Monetization

Traditional priority: highest bidder wins.

Our priority:
1. Most helpful to user
2. Highest quality score
3. Boosted by sponsor (if helpful)

**Helpful wins**, even without budget.

### 3. Transparency Over Deception

We publish the ranking formula. Users see exactly what's organic and what's sponsored.

**Visual differentiation:**
- Organic results: normal text
- Tier 1 boost: **bold**
- Tier 2 boost: *italic*
- Tier 3 boost: ***bold italic***

**One glance** tells you what's what. No investigating, no guessing.

**Ranking formula:**
```
Final Rank = (Organic Score × 0.6) + (Boost Amount × 0.4)

Where:
Organic Score = (Relevance × 0.4) + (CTR × 0.3) + (Quality × 0.2) + (Recency × 0.1)
```

Users see the math. Sponsors see the math. Everyone plays by the same rules.

### 4. Quality Over Quantity

- Maximum 10 links per page
- Only contextually relevant links
- High quality threshold
- User feedback incorporated

### 5. Privacy Over Surveillance

**What we analyze:** The content (public information).
**What we DON'T track:** User identity across sites, browsing history, personal information, cross-site behavior.

Content-based targeting, not user-based surveillance.

### 6. User Control Over Algorithm Control

Users decide how to weight organic vs sponsored:
- Show/hide sponsored links
- Filter by sponsorship tier
- See organic rank even for boosted links
- Report unhelpful links

## The Economic Model

### Traditional Web Economics
```
User value → Ad impressions → Advertiser payment → 70% to ad tech → 30% to publisher
```

### Helpful Web Economics
```
User value → Helpful links → Quality engagement → Sponsor boost → 90% to platform
```

**For sponsors:** Budget-based boosting, not auction bidding wars. When budget runs out, organic results take over. Quality score matters — better, more helpful links perform better even with less spend.

**For content creators:** Revenue share on boosts. Incentive to create high-quality, link-worthy content without plastering ads everywhere.

## Alignment of Incentives

- Helpful links → users engage → sponsors get quality leads → content creators earn share → platform gets revenue
- Transparency → users trust → more engagement → better ROI → more sponsors
- Quality content → better links → more engagement → more boosts → more revenue

**Negative cycles prevented:**
- Can't spam (quality score drops)
- Can't buy infinite ranking (boost caps)
- Can't game the system (transparency reveals it)
- Can't degrade UX (user controls)

## The Vision

We believe:
- **Advertising can be helpful** if designed correctly
- **Transparency builds trust** more than algorithmic opacity
- **Users should control their experience** rather than being controlled by it
- **Quality content deserves quality monetization** that doesn't degrade the experience
- **The web can be better** if we rethink fundamental assumptions about ads

*"What if the web helped you instead of interrupting you?"*
