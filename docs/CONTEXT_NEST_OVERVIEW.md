# Context Nest: PromptOwl's Knowledge Governance Layer

**For: Qaish (CTO) & Stacey (Marketing)**
**Date: February 2026**
**Status: Core Infrastructure Complete, AI Integration Pending**

---

## TL;DR

We built a **governed knowledge management system** that lets teams write, approve, and control what context their AI has access to. Think "Google Docs meets Git meets Obsidian" — but designed specifically for AI context control.

**The key insight:** Before AI can use your company's knowledge, someone needs to *approve* it. Context Nest is that approval layer.

---

## What Is It?

### For Qaish (Technical)

Context Nest is three things:

1. **A File Format Specification**
   - Obsidian-compatible markdown with YAML frontmatter
   - Portable — works without PromptOwl
   - `stewards.yaml` for portable permissions
   - Can round-trip: PromptOwl → Files → Obsidian → Files → PromptOwl

2. **A Governance System**
   - Document lifecycle: Draft → Pending Review → Approved
   - Stewardship hierarchy: Data Room → Folder → Tag → Document
   - Review queue with approve/reject workflow
   - Version history with restore capability

3. **An Adapter Architecture**
   - Storage-agnostic interfaces
   - PromptOwl is just one "client" of the spec
   - Could have CLI client, VS Code extension, etc.

### For Stacey (Business/Marketing)

Context Nest solves the "garbage in, garbage out" problem for enterprise AI:

> **"Who approved this information for the AI to use?"**

Before Context Nest:
- Anyone dumps docs into a vector store
- AI hallucinates from outdated/wrong info
- No audit trail, no accountability

After Context Nest:
- Subject matter experts review content
- Only approved knowledge reaches AI
- Full audit trail of who approved what
- Portable format — no vendor lock-in

**Positioning:** *"Governed context for enterprise AI"*

---

## What's Built (Working Today)

| Feature | Status | Description |
|---------|--------|-------------|
| Wiki Editor | ✅ Live | Markdown editor with `[[links]]`, `#tags`, `@mentions` |
| Document Versioning | ✅ Live | Full history, restore any version |
| Approval Workflow | ✅ Live | Submit → Review → Approve/Reject |
| Stewardship | ✅ Live | Assign who can approve what |
| Export to Files | ✅ Live | Download as Obsidian-compatible ZIP |
| Import from Files | ✅ Live | Upload Obsidian vault or Context Nest |
| Portable Permissions | ✅ Live | `stewards.yaml` travels with content |

### URLs in the App

- `/data-room/documents` — Create and edit wiki documents
- `/data-room/context` — Governance dashboard, review queue, steward management
- `/data-room/context-nest-test` — Test export/import (dev only)

---

## What's NOT Built Yet

| Feature | Priority | Description |
|---------|----------|-------------|
| AI Injection | HIGH | Approved docs auto-flow into LLM calls |
| Vector Indexing | HIGH | Semantic search / RAG over approved docs |
| Graph View | MEDIUM | Visualize wiki link connections |
| Full-text Search | MEDIUM | Search across all context documents |
| Real-time Collab | LOW | Live multi-user editing |

**The critical gap:** Approved documents exist, but they don't automatically feed into AI conversations yet. That's the next sprint.

---

## How It Works (User Flow)

```
1. AUTHOR
   └─ Write wiki document with [[links]], #tags
   └─ Save as draft

2. SUBMIT
   └─ Click "Submit for Review"
   └─ Routed to appropriate steward

3. REVIEW
   └─ Steward sees in review queue
   └─ Reviews content
   └─ Approves or rejects with note

4. APPROVED
   └─ Document locked at approved version
   └─ [FUTURE] Available for AI context injection

5. PORTABLE
   └─ Export entire knowledge base as files
   └─ Open in Obsidian, edit offline
   └─ Re-import changes
```

---

## Technical Architecture

```
┌─────────────────────────────────────────────────┐
│                 Context Nest Spec                │
│  (Obsidian-compatible markdown + YAML)          │
└─────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │ PromptOwl│   │ Obsidian │   │  Git/    │
  │  (Web)   │   │ (Desktop)│   │ GitHub   │
  └──────────┘   └──────────┘   └──────────┘
        │
        ▼
  ┌──────────────────────────────────────┐
  │            MongoDB Storage            │
  │  ┌────────────┐  ┌────────────────┐  │
  │  │ Documents  │  │ ContextSteward │  │
  │  │ (content)  │  │ (permissions)  │  │
  │  └────────────┘  └────────────────┘  │
  └──────────────────────────────────────┘
        │
        ▼ [NOT YET BUILT]
  ┌──────────────────────────────────────┐
  │         AI Context Injection          │
  │  Approved docs → LLM system prompts  │
  └──────────────────────────────────────┘
```

---

## Competitive Positioning

| Competitor | What They Do | Our Advantage |
|------------|--------------|---------------|
| Notion AI | AI on your wiki | No approval workflow, no portability |
| Confluence + Atlassian AI | Enterprise wiki + AI | Heavy, expensive, locked-in |
| Obsidian | Local-first markdown | No collaboration, no governance |
| RAG platforms | Vector search | No human approval layer |

**Our position:** We're the **governance layer** between human knowledge and AI consumption. Others do storage or search — we do *approval*.

---

## Key Files (for Qaish)

```
lib/context-nest/
├── CONTEXT_NEST_SPEC.md      # The format specification
├── types.ts                   # TypeScript types
├── adapters.ts               # Storage-agnostic interfaces
├── serializers.ts            # MongoDB ↔ File format
├── export-import.ts          # Export/import orchestration
└── __tests__/                # Unit tests

components/data-room/
├── MarkdownEditor/           # The wiki editor
├── stewardship/              # Review queue, steward management
└── context/                  # Governance dashboard

app/actions/
├── dataRoomDocuments.ts      # Document CRUD
├── documentLifecycle.ts      # Approval workflow
└── contextNestExportImport.ts # Export/import actions
```

---

## Next Steps

### Immediate (Next Sprint)
1. **Wire up AI injection** — Approved docs flow into LLM calls
2. **Vector indexing** — Enable semantic search over approved content

### Near-term
3. **Graph visualization** — See how documents connect
4. **Search** — Full-text search across context

### Future
5. **CLI tool** — `context-nest push/pull` like git
6. **VS Code extension** — Edit context from IDE
7. **Audit dashboard** — Analytics on context usage

---

## Questions?

- **Technical deep-dive:** See `CONTEXT_NEST_ARCHITECTURE.md`
- **Format spec:** See `CONTEXT_NEST_SPEC.md`
- **Try it:** Go to `/data-room/documents` and create some docs, then `/data-room/context` to see governance

---

*Built with Claude Code, February 2026*
