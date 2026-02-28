---
created: 2026-02-01
tags: [megacontext, promptowl, contextnest, product]
megacontext: [promptowl, sandbox]
status: active
---

# ContextNest

> The AI Context Control Plane — infrastructure for managing, governing, and routing context to LLMs across surfaces.

---

## Overview

**What it is:** A collaborative context management system that turns markdown-based documentation into an addressable, permissioned, network-injectable context layer. Think "GitHub for context" — version control, access control, and collaboration primitives for the knowledge that feeds AI.

**Core thesis:** Whoever controls context controls AI quality. Models are commoditizing. Context is the moat.

**Stage:** Phase 1 (Core Wiki) complete. Phase 2 (Control Plane Foundation) in progress.

**Relationship to PromptOwl:** Native component. The context layer that powers PromptOwl's RAG, chat, and agent systems. Eventually extractable as infrastructure other platforms can use.

---

## Strategic Position

### What This Is NOT
- Not an Obsidian competitor (Obsidian becomes a viewing layer)
- Not a note-taking app (it's infrastructure)
- Not a documentation tool (it's a context control plane)

### What This IS
- **For organizations** — Collaborative context management with governance
- **For AI systems** — Addressable, permissioned context registry
- **For developers** — Infrastructure layer for context-aware AI apps

### The Superpower (Closed Source)
When Claude (or any LLM) connects via MCP:
1. It can **traverse the context graph** — follow links, understand relationships
2. It can **load context dynamically** — pull what it needs, when it needs it
3. It respects **permissions and policies** — only sees what it's allowed to see
4. It **cites sources** — full provenance back to specific sections

This graph traversal + dynamic loading + governance = the moat. Keep closed.

---

## Product Vision

### Four Pillars

| Pillar | What | Status |
|---|---|---|
| **1. Desktop App** | Electron app with local-first editing, cloud sync, offline mode | Future |
| **2. Middleware** | Network layer that intercepts LLM calls and injects context | Future |
| **3. Governance** | Policies, audit logs, access control, compliance | In Progress |
| **4. Task/Context Management** | Ownership, maintenance workflows, staleness tracking | Future |

### Addressing Scheme

```
contextnest://document/{id}
contextnest://document/{title}
contextnest://tag/{name}
contextnest://path/{folder}/{subfolder}/{doc}
contextnest://mention/@{user}
contextnest://set/{context-set-name}
```

This makes every piece of context addressable across surfaces (web, CLI, desktop, API).

---

## Architecture

### What Exists (Phase 1 Complete)

**Editor:**
- Tiptap-based markdown editor with Obsidian-compatible syntax
- Extensions: WikiLink (`[[doc]]`), HashTag (`#tag`), Mention (`@user`), TaskCheckbox (`[ ]`)
- Decorations preserve raw markdown (critical for compatibility)

**Data Model:**
- `DataRoomDocument` — title, content, tags, wikiLinks, mentions, tasks, versions, locks
- `DataRoomTag` — shared taxonomy across docs/artifacts/folders
- Versioning — full snapshots, restore capability
- Locking — pessimistic, 30-min TTL

**APIs:**
- CRUD via Next.js Server Actions
- `/api/data-room/documents/search` — wiki link autocomplete
- `/api/data-room/tags/search` — shared taxonomy aggregation

**Codebase:** `C:\Users\misha\PromptOwl\components\data-room\`

### What's In Progress (Phase 2)

- Permission UI (document-level access control)
- Share-on-mention workflow
- Backlinks panel (query wired)
- Version history display

### What's Next (Phase 3-4)

- Context Registry API (addressable endpoints)
- MCP server integration
- Governance policy engine
- Audit logging
- Desktop app (Electron)
- CLI tools
- Network middleware

---

## Open Source Strategy

**Goal:** Create buzz in dev community, establish credibility, drive traffic to paid product.

### Open Source (Buzz Generators)

| Component | Why Open |
|---|---|
| **Tiptap Extensions** (WikiLink, HashTag, Mention, Task) | Useful to Tiptap/Obsidian community. npm package. |
| **Markdown Parser** (tag extraction, wiki link extraction) | Utility library. Low competitive risk. |
| **CLI Tools** (basic context injection) | Developer adoption. Trojan horse. |
| **"Context Protocol" Spec** | Standard for context addressing. Thought leadership. |

### Closed Source (Moat)

| Component | Why Closed |
|---|---|
| **Graph Traversal Engine** | The superpower. Dynamic context loading. |
| **Governance Policy Engine** | Enterprise value. Compliance. |
| **Permission Matrix** | Multi-tenant access control. |
| **Analytics / Usage Tracking** | Business intelligence. Pricing lever. |
| **Addressable Registry API** | The platform. What others build on. |

### Licensing Approach

- **Core wiki (basic)** — Open source (MIT or Apache 2.0)
- **Extensions npm package** — Open source (MIT)
- **Control plane features** — Source available, commercial license required
- **Enterprise features** — Proprietary

---

## Revenue Model

| Tier | What | Price |
|---|---|---|
| **Free** | Basic wiki, limited users, no governance | $0 |
| **Team** | Full wiki, collaboration, basic policies, usage analytics | $X/user/mo |
| **Enterprise** | Full governance, audit logs, SSO, custom policies, API access | $Y/user/mo |
| **Platform** | Middleware license, self-hosted, SLA | Custom |

**Upsell path:** Love the wiki free → need collaboration → need governance → need compliance → need middleware

---

## GTM Approach

### Phase 1: Developer Adoption
1. Open source Tiptap extensions as npm package
2. Write "Building an Obsidian-compatible editor" tutorial
3. Publish "Context Protocol" spec draft
4. Launch CLI with basic context injection

### Phase 2: Team Adoption
1. Launch free tier with collaboration
2. Content marketing: "Context is the new code"
3. Integrate with popular tools (Notion import, etc.)

### Phase 3: Enterprise
1. Governance features live
2. SOC 2 / compliance story
3. Direct sales motion

---

## Mockups & UX

### Existing Mockups

| Mockup | File | Status |
|---|---|---|
| Chat Integration | `mockups/chat-integration.md` | Good — needs context budget indicator |
| Context Manager | `mockups/context-manager.md` | Good — needs staleness + context sets |
| Context Navigation | `mockups/context-navigation.md` | Good — graph needs more spec |
| Governance Interface | `mockups/governance-interface.md` | Good — needs context debugger |

### Missing Mockups (TODO)

- [ ] **Onboarding flow** — Import from Notion? Google Docs? Blank slate?
- [ ] **CLI experience** — Developer workflow
- [ ] **Desktop app** — Local-first editing, sync status, offline mode
- [ ] **Context Debugger** — "Show me exactly what the AI saw"
- [ ] **Context Sets** — Curated bundles of docs for specific use cases

### UX Feedback to Incorporate

**Chat Integration:**
- Add context budget indicator (tokens used vs. limit)
- Add "Why this context?" explainer on citations

**Context Manager:**
- Add staleness indicator ("Last edited 6 months ago" warning)
- Add Context Sets/Bundles concept

**Context Navigation:**
- Specify edge types in graph (wiki link, tag co-occurrence, semantic similarity)
- Add clustering for large graphs (1000+ nodes)
- Add "pin subgraph as context set" feature

**Governance:**
- Add Context Debugger for troubleshooting AI outputs

---

## Technical Debt & Blockers

### Immediate

- [ ] Lock expiry cleanup (need background job)
- [ ] Backlinks query optimization
- [ ] Pagination on version history
- [ ] Permission checks (currently minimal)

### Security

- [ ] Lock acquisition not protected (any user can lock any doc)
- [ ] Share-on-mention doesn't validate recipient exists
- [ ] No rate limiting on document updates
- [ ] Audit log not implemented

---

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-02-01 | **Name: ContextNest** | Evocative (nest = where context lives, organized, protected). Memorable. |
| 2026-02-01 | Two products, one brand | PromptOwl (company + app) + ContextNest (infrastructure). No brand split. |
| 2026-02-01 | Obsidian = viewing layer, not integration target | Don't want to depend on their roadmap |
| 2026-02-01 | Graph traversal stays closed source | Core competitive moat |
| 2026-02-01 | Open source Tiptap extensions | Buzz, credibility, adoption |
| 2026-02-01 | Governance is upsell, not entry point | Free wiki → paid control plane |

---

## IP Protection & Disclosure

**Context (2026-02-03):** Before starting any new role, Misha needs disclosure in place. ContextNest needs to be publicly present (for IP protection) but opaque (not fully revealed).

**Requirements:**
- Landing page on PromptOwl site — **footer only, not main nav**
- Vague but present — establishes prior art without full reveal
- Alpha/design partner positioning — can claim existing product
- Dark, esoteric aesthetic (like early access/alpha)

**Status:** Need to create page. [[stacey]] flagged rev-rec concerns — cannot claim capabilities that don't exist. Solution: position as alpha seeking design partners.

---

## Open Questions

- [x] ~~Final product name?~~ **ContextNest** — decided 2026-02-01
- [ ] MCP server implementation timeline?
- [ ] Desktop app tech stack? (Electron vs Tauri)
- [ ] Import story — what formats do we support first?
- [ ] Domain: contextnest.com? contextnest.io? Check availability.
- [ ] ContextNest landing page copy — what can we say that's accurate?

---

## People

*TBD*

---

## Key Links

- [[contextnest-architecture.html]] — Visual architecture diagram + component breakdown (internal)
- [[contextnest-whitepaper]] — Technical white paper: "The Context Governance Gap"
- [[contextnest-marketing-foundationals]] — IS/DOES/MEANS, messaging, audience segments
- [[context-plane-gtm]] — GTM strategy, phasing, messaging, partners
- [[context-nest-gtm]] — GTM strategy (alternate)
- [[promptowl]] — Parent product
- [[_system/todo-dashboard|Todo Dashboard]] — Tasks
- Codebase: `C:\Users\misha\PromptOwl\components\data-room\`
- Core lib: `C:\Users\misha\PromptOwl\lib\context-nest\`
- Architecture doc: `components\data-room\ARCHITECTURE.md`
- Mockups: `components\data-room\mockups\`

---

## TODO — Prioritized

### Now (This Sprint)

- [ ] Complete ShareOnMentionModal — wire permission grant
- [ ] Implement backlinks query — show who references this doc
- [ ] Version history UI — display versions, enable restore
- [ ] Add pagination — documents list, version history

### Next (This Quarter)

- [ ] **Context Registry API** — Addressable endpoints for docs/tags/connections
- [ ] **Permission UI** — Document-level access control matrix
- [ ] **MCP Server** — Expose context registry to Claude, Cursor, etc.
- [ ] **Audit logging** — Start logging all context access
- [ ] **Context budget indicator** — Show token usage in chat

### Later (This Year)

- [ ] **Governance policy engine** — Rule builder for access/injection
- [ ] **Context Sets** — Curated doc bundles
- [ ] **Context Debugger** — Show exactly what AI saw
- [ ] **CLI tools** — Developer context injection
- [ ] **Desktop app** — Electron with local vault sync

### Someday

- [ ] Network middleware — Intercept LLM calls, inject context
- [ ] Graph visualization — Interactive connection browser
- [ ] Semantic search — Vector embeddings, AI suggestions
- [ ] Cross-org sharing — External user security model
- [ ] Open source npm package — Tiptap extensions

---

## Active Threads

- PromptOwl integration (native component)
- MCP design (how to expose the graph)
- Open source packaging (which pieces, when)
