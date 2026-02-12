---
created: 2026-02-03
tags: [promptowl, contextnest, product, marketing]
megacontext: [promptowl]
status: active
---

# ContextNest — Marketing Foundationals

> Derived from actual codebase analysis. This is what exists, not what's aspirational.

Related: [[context-plane]] | [[promptowl]] | [[personal-brand]]

---

## IS / DOES / MEANS

### IS (What it is)

**One-liner:** ContextNest is a governed context management system that turns your organization's knowledge into trusted, portable, AI-ready context.

**Elevator (30s):** ContextNest is where teams write, approve, and govern the knowledge that feeds their AI systems. Think "GitHub for AI context" — version-controlled documents with wiki links, hierarchical approval workflows, and a portable format that works in any markdown editor. Only approved context reaches your AI. Everything else is draft.

**Positioning statement:** For teams deploying AI agents and copilots, ContextNest is the context governance layer that ensures AI only uses vetted, current, permissioned knowledge — unlike RAG-over-a-file-dump approaches that have no quality control, no audit trail, and no accountability.

---

### DOES (What it does — built and shipping)

| Capability | What's Actually Built | Why It Matters |
|---|---|---|
| **Governed Wiki** | Rich markdown editor with wiki links `[[page]]`, hashtags `#tag`, @mentions, task lists | Teams write and connect knowledge naturally — like Obsidian, but collaborative |
| **Hierarchical Stewardship** | 4-level permission system: Document → Folder → Tag → Data Room. Stewards approve, reject, delegate. | The right people gate-keep the right context. Scales from 1 person to enterprise. |
| **Approval Workflow** | Draft → Pending Review → Approved/Rejected. Priority levels. Review queue. Rejection feedback. | Only approved documents become AI context. No unvetted knowledge in production. |
| **Version Control** | Full content snapshots, change notes, restore-to-any-version, approved-version tracking | Know exactly which version the AI is using. Roll back if something breaks. |
| **Document Locking** | Pessimistic locks with 30-min TTL. Visual indicators. | No merge conflicts. No "who edited last" confusion. |
| **Portable Format** | `.context/` directory with `config.yaml`, `stewards.yaml`, markdown files with YAML frontmatter | Take your context anywhere. Not locked to PromptOwl. Works in Obsidian, VS Code, any editor. |
| **Export / Import** | Full data room export to portable files. Obsidian vault import. ZIP generation. | Migrate in. Migrate out. Zero lock-in. |
| **Backlink Tracking** | Automatic tracking of which documents reference which | Navigate the knowledge graph. See what depends on what. |
| **Shared Taxonomy** | Tags shared across all documents. Click-to-filter. Autocomplete. | Consistent organization. AI can query by tag to pull relevant context sets. |
| **Mention-Based Sharing** | @mention someone → system flags if they need access → permission grant flow | Collaboration happens naturally inside the document. |
| **Addressable URIs** | `contextnest://document/{id}`, `contextnest://tag/{name}`, `contextnest://path/...` | Every piece of context is addressable. Agents can request exactly what they need. |
| **Storage-Agnostic Architecture** | Adapter pattern — swap MongoDB for Postgres, S3, local disk, whatever | Deploy anywhere. Not married to one stack. |

---

### MEANS (What it means for users)

**For AI/Engineering Teams:**
- Your agents only use context that's been reviewed and approved by a human
- You have a full audit trail of what context was used, when, and who approved it
- You can swap models and the context layer stays the same — context is the asset, not the model
- You can debug AI outputs by tracing back to the exact approved documents

**For Knowledge Managers / Ops:**
- You own the governance layer — who can write, who can approve, who can see
- You can delegate stewardship without losing control
- Your documentation is alive and connected, not buried in folders
- Nothing goes stale silently — version tracking and approval workflows surface decay

**For Executives / Compliance:**
- Every piece of AI context has a named steward and an approval chain
- Portable format means no vendor lock-in — you can leave anytime
- Audit logs show exactly who approved what for AI consumption
- Risk is bounded — only approved, versioned, attributed content reaches production

**For Developers / Builders:**
- Standard markdown — works in your existing editor
- Git-friendly — plain text, diffable, versionable
- Adapter pattern — integrate with your stack, not ours
- Addressable URIs — query context programmatically

---

## Key Differentiators (vs. competition)

| ContextNest | RAG-over-files | Notion/Confluence | Obsidian | Custom vector DB |
|---|---|---|---|---|
| Governed approval workflow | No governance | No AI-specific governance | No governance | No governance |
| Hierarchical stewardship | N/A | Page-level only | N/A | N/A |
| Portable format (.context/) | Vendor-locked | Vendor-locked | Local only | Vendor-locked |
| Version-controlled with approved versions | No versioning | Basic versioning | No native versioning | No versioning |
| Wiki links + backlinks + graph | Flat files | Limited linking | Strong linking | No linking |
| Works offline AND online | Online only | Online only | Offline only | Online only |
| Audit trail on AI context | No audit | No AI audit | N/A | No audit |

---

## Taglines & Messaging Candidates

**Primary:**
- "Governed context for AI that works."
- "The context layer your AI trusts."
- "Write it. Approve it. Deploy it. Trace it."

**Technical:**
- "GitHub for AI context."
- "Version-controlled, permission-aware, portable AI context."
- "The approval workflow between your knowledge and your AI."

**Enterprise:**
- "Know exactly what your AI knows."
- "Every AI answer traces back to an approved source."
- "Context governance at enterprise scale."

**Builder / PLG:**
- "Your AI is only as good as its context."
- "Stop feeding your AI unvetted docs."
- "Markdown-native. Git-friendly. AI-governed."

---

## Audience Segments

### 1. AI/Platform Engineering Teams
**Pain:** "We're doing RAG but we have no idea what quality of context is going in."
**Hook:** Approval workflow + audit trail + version control for context.
**Entry:** Free wiki → realize they need governance → upgrade.

### 2. Knowledge-Heavy Orgs (Legal, Medical, Finance, Consulting)
**Pain:** "We can't let AI use unreviewed content — compliance won't allow it."
**Hook:** Stewardship + approval + audit = compliance-ready AI context.
**Entry:** Enterprise sale. Governance is the wedge.

### 3. Consultants & Agencies
**Pain:** "We build AI solutions for clients but context management is always the mess."
**Hook:** Portable format + export/import + white-label = context layer for client engagements.
**Entry:** Use for one client → adopt as standard practice.

### 4. Developer / Builder Community
**Pain:** "I want structured context for my agents but I don't want to build the plumbing."
**Hook:** Addressable URIs + adapter pattern + open format.
**Entry:** Open source extensions → adopt platform.

---

## Proof Points (from what's built)

- **Production-grade editor** with 4 custom TipTap extensions (WikiLink, HashTag, Mention, TaskCheckbox)
- **Adapter pattern architecture** — storage-agnostic by design, not afterthought
- **Full export/import pipeline** — not just "we'll add portability later"
- **Hierarchical stewardship** at 4 levels — more granular than any competing system
- **Obsidian compatibility** — not reinventing syntax, respecting the ecosystem
- **Serialization layer** — documents convert cleanly between internal format and portable markdown

---

## What's NOT Built Yet (honest roadmap)

| Planned | Status | Why it matters for positioning |
|---|---|---|
| MCP server integration | Designed, not built | Agents query context dynamically |
| Context budget indicators | Planned | Show token usage per context set |
| Graph visualization | Planned | Visual navigation of knowledge connections |
| Desktop app (Electron) | Planned | Local-first editing with cloud sync |
| CLI tools | Planned | Developer workflow integration |
| Network middleware | Planned | Intercept LLM calls, inject context automatically |
| Governance policy engine | Planned | Rule-based access/injection policies |
| Context debugger | Planned | "Show me exactly what the AI saw" |

**Stacey's constraint applies:** Don't claim these on the website. Position as "coming" or "roadmap" only.

---

## Landing Page Direction (for IP/disclosure page)

Per 2026-02-03 Slack discussion — this page needs to:
- Exist (for IP prior art)
- Be opaque (not full feature reveal)
- Live in footer, not main nav
- Position as alpha / design partners

**Suggested copy approach:**

> **ContextNest**
> The context governance layer for AI.
>
> We're building the system that sits between your knowledge and your AI — ensuring every piece of context is authored, approved, versioned, and traceable.
>
> Currently in alpha with design partners.
>
> [Request Access]

This claims nothing that doesn't exist. It's accurate. It establishes the concept.

---

## Related Files

- [[context-plane]] — Full product strategy, architecture, open source plan
- [[context-nest-gtm]] — GTM strategy and phasing
- [[context-plane-gtm]] — GTM strategy (older version)
- [[promptowl]] — Parent company/product
- [[stacey]] — PLG website lead (rev-rec concerns noted)
- [[misha-sulpovar]] — Founder context, IP protection needs
