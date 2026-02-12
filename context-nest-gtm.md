---
created: 2026-02-01
tags: [promptowl, context-nest, gtm, strategy]
megacontext: [promptowl]
status: active
---

# Context Nest - Go-to-Market Strategy

> The hybrid play: layer distribution channels, don't choose one.

---

## The Name

**Context Nest** — where context lives, gets organized, and routes to AI.

---

## The Hybrid Play

Don't choose one approach. Layer them:

| Channel | Purpose | Timeline |
|---------|---------|----------|
| **Open Source** (Tiptap extensions) | Developer buzz, community, credibility | Feb-Mar |
| **MCP Server** | Instant distribution to Claude/Cursor users | Mar |
| **Design Partners** | Enterprise requirements + case studies | Mar-Apr |
| **Content Engine** | Thought leadership, pipeline | Mar ongoing |
| **Enterprise Sales** | Harvest when ready | Apr+ |

---

## 90-Day Plan

### February (Now)
- [ ] Finish Phase 2 (permissions, backlinks, versions)
- [ ] Start MCP server architecture
- [ ] Extract Tiptap extensions as standalone npm package

### March
- [ ] Ship MCP server + submit to Anthropic registry
- [ ] Publish `@promptowl/context-nest` npm package
- [ ] Reach out to Anthropic DevRel (Pavel, Alex)
- [ ] Start design partner outreach
- [ ] Begin content cadence (1 post/week)

### April
- [ ] 2 design partners signed
- [ ] Permission UI + audit logging shipped
- [ ] CLI v0.1
- [ ] Anthropic co-marketing ask

---

## Design Partner Profile

**Who we're looking for:**

| Criteria | Why |
|----------|-----|
| AI-forward teams | Already believe in the problem |
| Knowledge-heavy domain | Lawyers, consultants, researchers, engineers |
| 10-50 person teams | Big enough to have real needs, small enough to move fast |
| Technical decision maker accessible | Can say yes without procurement |
| Willing to be named | Case study value |

**Value exchange:**
- Free/discounted access during pilot
- Direct product influence
- Early access to features
- Co-marketing opportunity

---

## Design Partner Candidates

### Tier 1: High-Fit Industries (Knowledge-Heavy + AI-Forward)

**Legal Tech / Professional Services**
| Company | Why | Angle |
|---------|-----|-------|
| Harvey clients (mid-size law firms) | Already using AI for legal work, need context layer | Paying for Harvey but still have knowledge fragmentation |
| Supio ($91M raised, Sapphire Ventures) | Document analysis for litigation | Position as knowledge layer underneath their AI |
| Spellbook users | Contract lawyers in Word | Need context across deals, not just in-document |

**Pharma/Biotech Research**
| Company | Why | Angle |
|---------|-----|-------|
| Northern Light (Lone Tree Capital backed) | Enterprise intelligence for pharma CI | Their SinglePoint platform = exact problem space |
| Benchling customers | R&D knowledge management pain | 76% adoption of "literature extraction" shows need |
| Mid-size CROs (50-200 people) | Knowledge silos across studies | PE consolidation wave happening now |

**PE Portfolio Ops Teams**
| Target | Why | Angle |
|--------|-----|-------|
| Vista portfolio companies | Mandated AI adoption, 90+ companies | "Agentic AI Factory" needs context layer |
| Thoma Bravo portfolio | $30B revenue across 75 companies | Aisera investment shows interest in knowledge tools |
| Apollo CoE | Centralized AI team pushing to portfolio | External-facing, looking for tools to deploy |

### Tier 2: Specific Company Types

**Management Consulting (Mid-Market)**
- Boutique strategy firms (50-200 people)
- PE-backed consulting roll-ups (FourCentric model)
- Specialist advisory (M&A, restructuring, ops)

**Research & Analysis Firms**
- Market research firms
- Competitive intelligence shops
- Industry analyst firms

### Outreach Angles

| Angle | Target | Message |
|-------|--------|---------|
| "Knowledge fragmentation is killing your AI ROI" | Firms already spending on AI tools | You're paying for Claude/GPT but context is scattered |
| "Your context is your moat" | PE portfolio ops pushing AI adoption | The model is commodity, your docs aren't |
| "Obsidian for teams, with permissions" | Technical/research-oriented firms | Local-first, sync to cloud, route to AI |

### Warm (via existing network)

| Who | Domain | Connection | Status |
|-----|--------|------------|--------|
| Check: AGA | ? | Active client | Assess fit |
| Check: MrD | ? | Active client | Assess fit |
| Check: Emory | ? | Active client | Assess fit |

### Immediate Actions

1. [ ] Assess if AGA/MrD/Emory fit design partner profile
2. [ ] LinkedIn search: "Head of AI" at Vista/Thoma Bravo portfolio cos
3. [ ] Research Northern Light - direct competitor or partner?
4. [ ] Find mid-size law firms using Harvey

### Via Anthropic/Community

| Channel | Action |
|---------|--------|
| Anthropic Discord | Active participation, share MCP server |
| Claude subreddit | Thought leadership posts |
| MCP registry launch | Visibility to early adopters |

### Research Sources

- [Vista Equity Partners](https://www.vistaequitypartners.com/)
- [Thoma Bravo Portfolio](https://www.thomabravo.com/companies)
- [Korn Ferry: AI Reshaping Mid-Market PE](https://www.kornferry.com/institute/how-ai-is-reshaping-mid-market-pe-backed-industrials)
- [Benchling Biotech AI Report](https://www.benchling.com/biotech-ai-report-2026)
- [Northern Light Pharma CI](https://www.northernlight.com/blog/competitive-intelligence-in-pharma-key-trends)
- [Bain: GenAI in PE](https://www.bain.com/insights/field-notes-from-generative-ai-insurgency-global-private-equity-report-2025/)

---

## MCP Server Strategy

**What it does:**
```
User in Claude/Cursor → "Check my product requirements"
    → MCP server → Context Nest API
    → Returns relevant sections with permissions applied
```

**Why it matters:**
- Zero friction adoption (already in Claude)
- Proves the middleware thesis
- Gets us in front of AI-native users
- Registry listing = discoverability

**Build sequence:**
1. `context_search` - semantic search across docs
2. `context_get` - retrieve specific document
3. `context_list_tags` - browse by tag
4. `context_inject` - add to conversation context

---

## Open Source Strategy

**Package: `@promptowl/context-nest-tiptap`**

What we open source:
- WikiLink extension (with existence checking)
- HashTag extension (with taxonomy)
- Mention extension (with permission hooks)
- TaskCheckbox extension

What stays proprietary:
- Sync infrastructure
- Permission system
- Analytics/audit
- Enterprise features

**Why:**
- Community builds trust
- Developers become advocates
- Extensions are commodity, platform is value
- GitHub stars → credibility

---

## Content Engine

**Thesis posts:**
- "Why AI assistants need a context layer"
- "The hidden bottleneck in enterprise AI adoption"
- "From RAG to context routing: the next evolution"

**Technical posts:**
- "Building Obsidian-compatible syntax with ProseMirror"
- "How we built a context-aware MCP server"
- "Permission models for AI context injection"

**Distribution:**
- LinkedIn (Misha's network)
- Twitter/X (developer audience)
- Hacker News (launch posts)
- Dev.to / Hashnode (technical deep dives)

---

## Critical Path Dependencies

```
Phase 2 Complete
      ↓
┌─────┴─────┐
│           │
MCP Server  npm Package
│           │
└─────┬─────┘
      ↓
Registry + Launch
      ↓
Design Partner Outreach
      ↓
Enterprise Readiness
```

---

## Open Questions

1. **First design partner** — who in the network is AI-forward + knowledge-heavy?
2. **Anthropic relationship** — who's the right DevRel contact?
3. **Pricing model** — free tier vs. enterprise only?
4. **Naming** — Context Nest as product name, or PromptOwl Context Nest?

---

## Related

- [[promptowl]] — Parent project
- [[PromptOwl Control Plane Architecture]] — Technical architecture
- [[context-plane]] — Strategy context

---

**Priority:** Critical Path
**Status:** Planning
**Next Action:** Identify first design partner candidate
