# Context Nest Architecture

Context Nest is a wiki-style knowledge management system designed to run independently or embedded within PromptOwl.

## Design Goals

1. **Platform Independence** - Can run standalone with different storage backends
2. **Adapter Pattern** - External dependencies injected via typed interfaces
3. **Feature Toggles** - Optional features (locking, stewardship, vector indexing)
4. **Type Safety** - Full TypeScript with strict types

## Module Structure

```
lib/context-nest/
├── index.ts              # Public API exports
├── types.ts              # Core data types (platform-agnostic)
├── adapters.ts           # Adapter interfaces
├── promptowl-adapters.ts # PromptOwl-specific implementations
└── ARCHITECTURE.md       # This file

components/data-room/     # UI Components (React)
├── MarkdownEditor/       # TipTap-based editor
├── DocumentViewer/       # View components
├── stewardship/          # Approval workflow UI
├── context/              # Dashboard components
└── index.ts              # Component exports

app/actions/              # Server Actions
├── dataRoomDocuments.ts  # Document CRUD
├── contextStewardship.ts # Steward management
├── documentLifecycle.ts  # Approval workflow
└── dataRoomTeam.ts       # Team lookup

db/models/                # Database Models
├── dataRoomDocument.ts   # Document schema
├── contextSteward.ts     # Steward schema
├── reviewRequest.ts      # Review request schema
└── dataRoomTag.ts        # Tag schema
```

## Adapter Interfaces

### Required Adapters

| Adapter | Purpose |
|---------|---------|
| `AuthAdapter` | Current user authentication |
| `DocumentStorageAdapter` | Document CRUD and search |
| `StewardshipStorageAdapter` | Steward/review management |
| `TagStorageAdapter` | Tag search and listing |
| `UserLookupAdapter` | User/team search for mentions |

### Optional Adapters

| Adapter | Purpose |
|---------|---------|
| `VectorStoreAdapter` | AI context indexing |
| `NotificationAdapter` | Email/webhook notifications |

## Running Independently

To run Context Nest outside PromptOwl:

1. **Implement Required Adapters**
   ```typescript
   const config: ContextNestConfig = {
     auth: myAuthAdapter,
     documents: myDocumentAdapter,
     stewardship: myStewardshipAdapter,
     tags: myTagAdapter,
     users: myUserAdapter,
   };
   ```

2. **Replace Database Models**
   - Implement adapters using your preferred database
   - PostgreSQL, SQLite, or any other backend

3. **Use UI Components**
   - Components accept data via props
   - Server actions can be replaced with adapter calls

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  MarkdownEditor → DocumentEditorPage → DocumentsListPage    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Adapter Layer                             │
│  AuthAdapter │ DocumentAdapter │ StewardshipAdapter │ ...   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Storage Layer                              │
│  MongoDB (PromptOwl) │ PostgreSQL │ SQLite │ Custom         │
└─────────────────────────────────────────────────────────────┘
```

## Feature Flags

```typescript
features: {
  documentLocking: true,     // Collaborative edit locking
  lockDurationMs: 1800000,   // 30 minutes
  stewardship: true,         // Approval workflow
  vectorIndexing: false,     // AI context indexing
  notifications: false,      // Email notifications
}
```

## Dependencies

### Core (No External Dependencies)
- `lib/context-nest/types.ts`
- `lib/markdownParser.ts`
- `lib/dataRoomDocumentHelpers.ts`

### PromptOwl Integration
- NextAuth (authentication)
- MongoDB/Mongoose (storage)
- shadcn/ui (UI components)

### Optional
- LangChain (vector store)
- Resend/SendGrid (notifications)

## Future Enhancements

1. **GraphQL API** - Alternative to server actions
2. **Real-time Sync** - WebSocket-based collaboration
3. **Export/Import** - Markdown file export, Obsidian import
4. **Plugin System** - Custom extensions
