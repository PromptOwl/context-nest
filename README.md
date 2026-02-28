# research-leadership
Research internal. Only for leadership. Contains research projects overall.

---

# ContextNest — Full Codebase Package

**Date:** 2026-02-28 (Hackathon Day 1)
**For:** Qaish, Stacey, Misha

---

## What This Is

Everything built so far for ContextNest, extracted from the PromptOwl codebase. This is the starting point for the hackathon.

---

## Directory Structure

```
contextnest-package/
├── docs/                          # Specs, architecture, overview
│   ├── CONTEXT_NEST_SPEC.md       # ← START HERE (Qaish) — Open spec v1.0
│   ├── ARCHITECTURE.md            # Internal architecture (lib perspective)
│   ├── CONTEXT_NEST_ARCHITECTURE.md  # Business-facing architecture
│   └── CONTEXT_NEST_OVERVIEW.md   # High-level overview (written for Qaish + Stacey)
│
├── lib/context-nest/              # Core TypeScript library
│   ├── index.ts                   # Public API exports
│   ├── types.ts                   # Core types (ContextDocument, Steward, WikiLink, etc.)
│   ├── adapters.ts                # Platform-agnostic adapter interfaces
│   ├── promptowl-adapters.ts      # MongoDB/PromptOwl-specific implementations
│   ├── serializers.ts             # ← KEY FILE — markdown ↔ document conversion,
│   │                              #   generateIndex(), extractMetadata()
│   ├── export-import.ts           # Full round-trip: PromptOwl ↔ portable markdown
│   └── __tests__/
│       └── serializers.test.ts    # Unit tests
│
├── extensions/                    # TipTap editor extensions (open source candidates)
│   ├── WikiLink.ts                # [[wiki links]] with existence checking
│   ├── Mention.ts                 # @user, @(Full Name), @team:name
│   ├── HashTag.ts                 # #tag-name with autocomplete
│   └── TaskCheckbox.ts            # - [ ] / - [x] GFM task lists
│
├── components/                    # React UI components
│   ├── MarkdownEditor/            # TipTap-based editor + toolbar + autocomplete
│   ├── DocumentViewer/            # Approval history, backlinks, versions, tags
│   ├── stewardship/               # Review queue, approve/reject, steward assignment
│   └── context/                   # Governance dashboard + timeline
│
├── server-actions/                # Next.js server actions
│   └── contextNestExportImport.ts # Export/import API (auth + MongoDB)
│
└── mcp-server/                    # Model Context Protocol server
    ├── package.json               # @promptowl/mcp-server
    ├── tsconfig.json
    ├── README.md
    ├── LICENSE
    └── src/
        └── index.ts               # MCP server implementation
```

---

## What's Built

- Wiki editor with custom TipTap extensions (WikiLink, Mention, HashTag, TaskCheckbox)
- Document lifecycle: draft → pending_review → approved → rejected
- Stewardship/governance: assign stewards to docs/folders/tags, review queue, approve/reject
- Version history at document level
- Backlinks panel (documents linking to current document)
- Export/import: PromptOwl ↔ portable markdown files ↔ Obsidian
- Auto-generated INDEX.md (precursor to context.md)
- MCP server (standalone, for Claude Code integration)
- Adapter pattern: all storage is behind interfaces, not hardcoded to MongoDB

## What's NOT Built (Hackathon Gaps)

- Auto-generated `context.md` with full graph navigation (whiteboarded today)
- Edge descriptors / relationship types on links
- Tool call link type (with params + timestamps)
- AI context injection (the middleware patent describes this)
- Vector indexing into graph
- Public vs. private context scoping
- The "agentic SEO" concept (URL → scrape → context → JS snippet)
- Desktop Electron client (Hootie)

---

## Reading Order

**Qaish:**
1. `docs/CONTEXT_NEST_OVERVIEW.md` — 5 min, big picture
2. `docs/CONTEXT_NEST_SPEC.md` — the format spec, this is what we're extending
3. `lib/context-nest/serializers.ts` — `generateIndex()` is the precursor to auto context.md
4. `lib/context-nest/types.ts` — data model
5. `lib/context-nest/adapters.ts` — platform-agnostic interfaces
6. `mcp-server/src/index.ts` — existing MCP, this is what gets modified

**Stacey:**
1. `docs/CONTEXT_NEST_OVERVIEW.md` — positioning + status
2. `docs/CONTEXT_NEST_ARCHITECTURE.md` — business-facing architecture
3. The white paper in the Obsidian vault: `obsidianbrain/contextnest-whitepaper.md`

---

## Hackathon Priorities (Feb 28-Mar 1)

1. Lock the SDK format (extend the spec with edge descriptors, tool links, context.md auto-gen)
2. Build working POC (one client, MCP-accessible)
3. Update + deploy white paper
4. File patent provisionals (governance/middleware)
