# Context Nest Architecture

## Overview

Context Nest is a **portable, self-contained knowledge management system** that can operate independently or integrate with PromptOwl for enhanced features. It follows the principle that **the format is the product** - a well-defined specification that any tool can read/write.

## Design Philosophy

### Core Principles

1. **Format First**: The Context Nest spec defines a portable file format. Tools (including PromptOwl) are just clients of this format.

2. **Storage Agnostic**: The same content can live in:
   - Local filesystem (plain folders)
   - Git repository (version control)
   - MongoDB (PromptOwl's choice)
   - Any storage backend

3. **Progressive Enhancement**:
   - **Baseline**: Any text editor can read/write
   - **Git-enhanced**: Version history, collaboration, PRs
   - **PromptOwl-enhanced**: Rich UI, real-time collaboration, AI agents

4. **Obsidian Compatible**: Uses standard markdown conventions that work in Obsidian, Notion, and other tools.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Context Nest Spec                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   YAML      │  │  Wiki Links │  │    Tags     │  │   Tasks     │    │
│  │ Frontmatter │  │  [[page]]   │  │   #tag      │  │  - [ ] item │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │ Filesystem│   │    Git    │   │  MongoDB  │
            │  (local)  │   │  (remote) │   │(PromptOwl)│
            └───────────┘   └───────────┘   └───────────┘
                    │               │               │
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │  Obsidian │   │  GitHub   │   │ PromptOwl │
            │   (UI)    │   │   (UI)    │   │   (UI)    │
            └───────────┘   └───────────┘   └───────────┘
```

## Component Structure

### File Format Layer (`CONTEXT_NEST_SPEC.md`)

Defines the portable format:

```
my-context-nest/
├── .context/                    # Configuration
│   ├── config.yaml              # Nest settings
│   └── stewards.yaml            # Permissions (portable)
├── INDEX.md                     # Auto-generated directory listing
├── engineering/
│   ├── INDEX.md
│   ├── api-design.md            # Document with frontmatter
│   └── .versions/               # Optional version history
│       └── api-design/
│           ├── v1.md
│           └── history.yaml
└── product/
    └── roadmap.md
```

### Serialization Layer (`lib/context-nest/serializers.ts`)

Converts between internal representation and spec format:

| Function | Purpose |
|----------|---------|
| `serializeDocument()` | ContextDocument → SerializedDocument |
| `deserializeDocument()` | SerializedDocument → ContextDocument |
| `documentToMarkdown()` | SerializedDocument → Markdown string |
| `parseMarkdown()` | Markdown string → frontmatter + body |
| `serializeStewards()` | ContextSteward[] → stewards.yaml |
| `deserializeStewards()` | stewards.yaml → ContextSteward[] |
| `generateIndex()` | Documents → INDEX.md content |
| `extractMetadata()` | Markdown body → wiki links, tags, mentions, tasks |

### Export/Import Layer (`lib/context-nest/export-import.ts`)

High-level operations:

| Function | Purpose |
|----------|---------|
| `exportContextNest()` | Full data room → file array |
| `importContextNest()` | File array → documents + stewards |
| `importFromObsidian()` | Obsidian vault → documents |

### Adapter Layer (`lib/context-nest/adapters.ts`)

Abstracts storage backend:

```typescript
interface DocumentStorageAdapter {
  createDocument(data): Promise<ContextDocument>;
  getDocument(id): Promise<ContextDocument | null>;
  updateDocument(id, data): Promise<ContextDocument>;
  deleteDocument(id): Promise<void>;
  listDocuments(params): Promise<{ documents, total }>;
  searchDocuments(query): Promise<DocumentSearchResult[]>;
  // ... wiki link resolution, backlinks
}

interface StewardshipStorageAdapter {
  assignSteward(data): Promise<ContextSteward>;
  getStewardsForScope(params): Promise<ContextSteward[]>;
  resolveStewardsForDocument(id): Promise<ContextSteward[]>;
  // ... review queue management
}
```

### PromptOwl Implementation (`lib/context-nest/promptowl-adapters.ts`)

MongoDB-backed implementation of adapters:

```typescript
// Uses existing models:
// - DataRoomDocument (MongoDB)
// - ContextSteward (MongoDB)
// - DataRoomFolder (MongoDB)

const config = createPromptOwlContextNestConfig();
// Returns adapters backed by PromptOwl's database
```

### Server Actions (`app/actions/contextNestExportImport.ts`)

API for UI:

| Action | Purpose |
|--------|---------|
| `exportDataRoomAsContextNest()` | Export data room → downloadable files |
| `importContextNestToDataRoom()` | Upload files → create documents |
| `importObsidianVault()` | Import Obsidian vault directly |

### Editor Components (`components/data-room/MarkdownEditor/`)

TipTap-based editor with spec-compliant extensions:

| Extension | Syntax | Purpose |
|-----------|--------|---------|
| `WikiLink.ts` | `[[page]]`, `[[page\|display]]` | Internal links |
| `HashTag.ts` | `#tag-name` | Categorization |
| `Mention.ts` | `@user`, `@team:name` | People references |
| `TaskCheckbox.ts` | `- [ ]`, `- [x]` | Actionable items |

## Data Flow

### Export Flow

```
PromptOwl Data Room
        │
        ▼
┌─────────────────────────────────┐
│ exportDataRoomAsContextNest()   │  Server Action
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│ exportContextNest()             │  Orchestrator
│  - Fetch documents from MongoDB │
│  - Fetch stewards               │
│  - Resolve user emails          │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│ serializeDocument() (each doc)  │  Serializer
│ serializeStewards()             │
│ generateIndex() (each folder)   │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│ File Array                      │  Output
│  - path: "engineering/api.md"   │
│  - content: "---\ntitle:..."    │
└─────────────────────────────────┘
        │
        ▼
    ZIP download (client-side)
```

### Import Flow

```
File Upload / Obsidian Vault
        │
        ▼
┌─────────────────────────────────┐
│ importContextNestToDataRoom()   │  Server Action
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│ importContextNest()             │  Orchestrator
│  - Parse config.yaml            │
│  - Parse stewards.yaml          │
│  - Create folders               │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│ parseMarkdown() (each file)     │  Serializer
│ deserializeDocument()           │
│ extractMetadata()               │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│ DataRoomDocument.create()       │  MongoDB
│ ContextSteward.create()         │
└─────────────────────────────────┘
```

## Stewardship (Permissions) System

### Hierarchy

```
Data Room Steward (highest)
    │
    ├── Can approve ANY document in the data room
    │
Folder Steward
    │
    ├── Can approve documents in that folder
    │
Tag Steward
    │
    ├── Can approve documents with that tag
    │
Document Steward (most specific)
    │
    └── Can approve only that document
```

### Resolution Order

When determining who can approve a document:
1. Check document-level stewards first
2. Check tag-level stewards
3. Check folder-level stewards
4. Check data room-level stewards

### Portable Format (`stewards.yaml`)

```yaml
version: 1

data_room:
  - email: admin@example.com
    can_approve: true
    can_reject: true
    can_delegate: true

folders:
  engineering:
    - email: tech.lead@example.com
      can_approve: true

tags:
  security:
    - email: security@example.com
      can_approve: true

documents:
  "API Design Guidelines":
    - email: api.lead@example.com
      can_approve: true
```

## Document Lifecycle

```
┌─────────┐     submit      ┌────────────────┐
│  DRAFT  │ ───────────────►│ PENDING_REVIEW │
└─────────┘                 └────────────────┘
     ▲                              │
     │                    ┌─────────┴─────────┐
     │                    ▼                   ▼
     │            ┌───────────┐        ┌──────────┐
     └────────────│  REJECTED │        │ APPROVED │
       (revise)   └───────────┘        └──────────┘
```

### States

| State | Description |
|-------|-------------|
| `draft` | Work in progress, editable |
| `pending_review` | Submitted for approval |
| `approved` | Approved by steward, locked |
| `rejected` | Needs revision |

## AI Agent Integration

Context Nest is designed to be AI-agent friendly:

### Structured Format
- YAML frontmatter is machine-parseable
- Clear metadata (status, tags, ownership)
- Predictable file locations

### Permission-Aware
- Agents can check stewardship before suggesting edits
- Approval workflow ensures human oversight
- Audit trail via versions

### Context Injection
```typescript
// Example: Loading approved context for an AI agent
const approvedDocs = await documents.list({
  dataRoomId,
  lifecycleStatus: "approved",
  tags: ["guidelines", "policies"]
});

// Inject into system prompt
const context = approvedDocs.map(d =>
  `## ${d.title}\n${d.content}`
).join("\n\n");
```

### INDEX.md for Discovery
Auto-generated indexes help agents understand structure:
```markdown
## Documents
| Document | Status | Tags |
|----------|--------|------|
| [[API Guidelines]] | approved | #api |
| [[Security Policy]] | approved | #security |
```

## Integration Points

### With Data Room
- Context Nest lives inside a Data Room
- Inherits Data Room access controls
- Shares user/team membership

### With PromptOwl Prompts
- Context documents can be referenced in prompts
- Approved documents ensure quality context
- Tags enable dynamic context selection

### With External Tools
- Export to Obsidian vault
- Import from Obsidian
- Git-based workflows possible
- CI/CD for documentation

## Future Considerations

### Planned Enhancements
1. **Real-time sync** - Bidirectional sync with git repos
2. **Conflict resolution** - Handle concurrent edits across tools
3. **Template system** - Pre-defined document templates
4. **Graph view** - Visual navigation of wiki links

### Extension Points
- Custom frontmatter fields (prefixed: `promptowl_*`)
- Additional config files in `.context/`
- Plugin system for custom serializers

## File Reference

| File | Purpose |
|------|---------|
| `lib/context-nest/CONTEXT_NEST_SPEC.md` | Format specification |
| `lib/context-nest/types.ts` | TypeScript type definitions |
| `lib/context-nest/adapters.ts` | Storage adapter interfaces |
| `lib/context-nest/promptowl-adapters.ts` | MongoDB implementations |
| `lib/context-nest/serializers.ts` | Format conversion |
| `lib/context-nest/export-import.ts` | High-level export/import |
| `lib/context-nest/index.ts` | Public API exports |
| `app/actions/contextNestExportImport.ts` | Server actions |
| `components/data-room/MarkdownEditor/` | Editor components |
| `db/models/DataRoomDocument.ts` | Document model |
| `db/models/ContextSteward.ts` | Steward model |

## Summary

Context Nest is:
- **A specification** (not a product)
- **Obsidian-compatible** (industry standard syntax)
- **Self-contained** (works without any tool)
- **PromptOwl-enhanced** (rich features when integrated)
- **AI-agent ready** (structured for programmatic access)
- **Git-friendly** (plain text, diffable)

The key insight: **MongoDB is just PromptOwl's storage choice**. The format is portable, and any tool can read/write Context Nest files.
