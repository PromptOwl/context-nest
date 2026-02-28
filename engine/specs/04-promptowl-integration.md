# Specification: PromptOwl Integration

## Purpose
Define how the context engine integrates with PromptOwl's UI, workflows, and MCP tool system to provide seamless context management for both users and agents.

## Principles
1. **Dual Access**: Users via UI, agents via MCP tool
2. **Live Sync**: CLI changes sync to PromptOwl (with API key)
3. **Visual Feedback**: Token estimates, policy previews, drift detection
4. **Zero Disruption**: Works alongside existing artifact system

---

## Example 1: Context Pack in Prompt Editor

### Context
User is editing a prompt in PromptOwl prompt editor

### Action
1. User clicks "Add Context Pack" button
2. Selector dialog opens
3. User types: `#onboarding + #external`
4. Real-time preview shows:
   - 3 documents matched
   - ~2,400 tokens estimated
   - 1 policy will apply: `policy:pii.redact_external`

### Expected Result
UI shows:
```
┌─────────────────────────────────────────┐
│ Context Pack Preview                    │
├─────────────────────────────────────────┤
│ Selector: #onboarding + #external       │
│                                         │
│ ✓ Getting Started Guide      (800 tok) │
│ ✓ Product Overview          (1200 tok) │
│ ✓ FAQ                        (400 tok) │
│                                         │
│ Total: 3 docs, ~2400 tokens            │
│                                         │
│ 📋 Policies:                            │
│  • PII Redaction (external audience)   │
│                                         │
│ [Insert Context Pack]  [Cancel]        │
└─────────────────────────────────────────┘
```

When user clicks "Insert Context Pack":
- Prompt system message gets placeholder: `{{context:pack:01J…AB}}`
- Pack saved to conversation metadata
- Pack resolved at runtime when conversation starts

---

## Example 2: Agent Uses MCP Tool

### Context
LangChain workflow with MCP tools enabled

Agent block definition:
```yaml
name: "research_assistant"
tools:
  - ctx_resolve
  - web_search
```

### Action
Agent thinks: "I need company context to answer this question"

Agent calls tool:
```json
{
  "tool": "ctx_resolve",
  "parameters": {
    "selector": "#company-overview + #public",
    "max_tokens": 5000
  }
}
```

### Expected Result
Tool returns:
```json
{
  "bundle_id": "ulid:01J…CD",
  "nodes": [
    {
      "id": "ulid:01J…EF",
      "title": "Company Mission",
      "content": "...",
      "tokens": 350
    },
    {
      "id": "ulid:01J…GH",
      "title": "Product Overview",
      "content": "...",
      "tokens": 1200
    }
  ],
  "total_tokens": 1550,
  "policies_applied": ["policy:pii.redact_external"]
}
```

Agent uses content to formulate response.

Conversation metadata records:
```json
{
  "context_bundles_used": [
    {
      "bundle_id": "ulid:01J…CD",
      "selector": "#company-overview + #public",
      "resolved_at": "2025-10-28T20:45:12Z",
      "node_count": 2,
      "token_count": 1550
    }
  ]
}
```

---

## Example 3: CLI Sync to PromptOwl

### Context
User has PromptOwl account with API key stored locally in `~/.promptowl/credentials`

User creates new context node locally:
```bash
echo "# New Runbook" > vault/new-runbook.md
ctx store vault/new-runbook.md
```

### Action
```bash
ctx sync --push
```

### Expected Result
1. CLI authenticates with PromptOwl API
2. Uploads new node to user's context vault in PromptOwl
3. PromptOwl MongoDB contains new `ContextNode` document:
   ```json
   {
     "_id": "ulid:01J…IJ",
     "userId": "usr_12345",
     "title": "New Runbook",
     "content": "# New Runbook",
     "type": "document",
     "checksum": "sha256:...",
     "synced_from_cli": true,
     "synced_at": "2025-10-28T20:50:00Z"
   }
   ```
4. CLI output:
   ```
   ✓ Synced 1 node to PromptOwl
     • new-runbook.md → ulid:01J…IJ

   View in PromptOwl: https://app.promptowl.ai/context
   ```

---

## Example 4: Drift Detection

### Context
User creates context pack in PromptOwl with selector `#product-docs`

Initially resolves to 5 documents

One week later, team adds 2 new docs tagged `#product-docs`

### Action
User opens old conversation that used the pack

### Expected Result
PromptOwl shows drift badge:
```
┌─────────────────────────────────────────┐
│ ⚠️ Context Pack Updated                 │
├─────────────────────────────────────────┤
│ Pack "product-docs" has changed since   │
│ this conversation started.              │
│                                         │
│ Original: 5 docs, 3,200 tokens          │
│ Current:  7 docs, 4,100 tokens          │
│                                         │
│ [View Changes] [Update Context]         │
└─────────────────────────────────────────┘
```

If user clicks "View Changes":
- Shows diff: 2 new documents added
- Preview of new content

If user clicks "Update Context":
- Re-resolves pack with current vault state
- Conversation metadata records update:
  ```json
  {
    "context_pack_updated": {
      "pack_id": "pack:product.docs",
      "original_etag": "sha256:...",
      "new_etag": "sha256:...",
      "updated_at": "2025-10-28T21:00:00Z"
    }
  }
  ```

---

## Example 5: Server Action - Resolve Context

### Context
User clicks "Add Context" in PromptOwl UI

### Action
Server Action called:
```typescript
const result = await resolveContext({
  selector: "#onboarding + type:document",
  actor: `user:${session.user.id}`,
  audience: "internal",
  maxTokens: 10000
});
```

### Expected Result
Server Action:
1. Calls `connectDb()`
2. Queries MongoDB `context_nodes` collection with selector
3. Checks permissions against user's principals
4. Applies org-level policies
5. Returns bundle:
   ```typescript
   {
     bundleId: "ulid:01J…KL",
     nodes: [...],
     totalTokens: 5400,
     policiesApplied: ["policy:acme.compliance"],
     manifest: { ... }
   }
   ```

UI displays preview and inserts into prompt.

---

## Example 6: Context Pack in Sequential Workflow

### Context
User creates sequential prompt with 3 blocks:
1. Research block
2. Analysis block
3. Report block

### Action
User adds context pack to Block 1:
```
Selector: #competitive-intelligence
```

Block 2 references Block 1 output:
```
System: Analyze the following research: {{block_1_output}}
```

### Expected Result
When workflow runs:
1. Block 1 resolves context pack (3 docs, 4,000 tokens)
2. Block 1 LLM receives context + user input
3. Block 1 output: "Key findings: ..."
4. Block 2 receives Block 1 output (context NOT re-sent, only findings)
5. Block 3 processes final report

Conversation metadata:
```json
{
  "workflow_context": {
    "block_1": {
      "context_pack": "pack:competitive.intel",
      "tokens_used": 4000,
      "bundle_id": "ulid:01J…MN"
    }
  }
}
```

---

## Example 7: Pack Management UI

### Context
User navigates to "Context Packs" page in PromptOwl

### Action
User sees list of saved packs:
```
┌────────────────────────────────────────────────┐
│ Context Packs                                  │
├────────────────────────────────────────────────┤
│ Onboarding Basics                              │
│ #onboarding + type:document                    │
│ 5 docs • ~3.2k tokens • Last used: 2 days ago  │
│ [Edit] [Preview] [Delete]                      │
├────────────────────────────────────────────────┤
│ Product Docs (External)                        │
│ #product + #public                             │
│ 8 docs • ~6.1k tokens • Last used: 1 week ago  │
│ [Edit] [Preview] [Delete]                      │
├────────────────────────────────────────────────┤
│ [+ Create New Pack]                            │
└────────────────────────────────────────────────┘
```

### Expected Result
- Packs stored in MongoDB `context_packs` collection
- Usage stats tracked (last_used, usage_count)
- Preview button shows current resolution without executing

---

## Example 8: Export with Approval UI

### Context
User wants to export conversation that includes restricted context

Policy requires approval from `role:compliance`

### Action
User clicks "Export Conversation"

### Expected Result
UI shows approval request dialog:
```
┌─────────────────────────────────────────┐
│ Export Requires Approval                │
├─────────────────────────────────────────┤
│ This conversation includes restricted   │
│ context that requires compliance        │
│ approval before export.                 │
│                                         │
│ Restricted Nodes:                       │
│ • Financial Report Q3 2025              │
│ • Customer Contract Template            │
│                                         │
│ [Request Approval]  [Cancel]            │
└─────────────────────────────────────────┘
```

If user clicks "Request Approval":
1. Creates `ContextExportRequest` in MongoDB:
   ```json
   {
     "_id": "export_req_001",
     "userId": "usr_12345",
     "conversationId": "conv_456",
     "restricted_nodes": ["ulid:01J…OP", "ulid:01J…QR"],
     "required_approver_role": "compliance",
     "status": "pending",
     "requested_at": "2025-10-28T21:15:00Z"
   }
   ```
2. Notification sent to users with `role:compliance`
3. User sees pending status

When compliance officer approves:
1. `ContextExportApproval` document created
2. Export proceeds
3. Original requester notified
4. Audit log records approval

---

## Example 9: Context Token Budget in Prompt Editor

### Context
User editing prompt with token budget enforcement

PromptOwl settings: `max_context_tokens: 8000`

### Action
User adds context pack that resolves to 10,000 tokens

### Expected Result
UI shows warning:
```
┌─────────────────────────────────────────┐
│ ⚠️ Token Budget Exceeded                │
├─────────────────────────────────────────┤
│ Selected context: 10,000 tokens         │
│ Your budget:      8,000 tokens          │
│ Overflow:         2,000 tokens          │
│                                         │
│ Options:                                │
│ • Apply auto-summarization              │
│ • Refine selector to reduce matches     │
│ • Increase token budget                 │
│                                         │
│ [Apply Summary] [Edit Selector] [Cancel]│
└─────────────────────────────────────────┘
```

If user clicks "Apply Summary":
- Policy `policy:summarize.auto` applied
- Context reduced to fit budget
- User preview shows summarized content

---

## Example 10: Conversation Context Metadata

### Context
Every conversation using context packs tracks metadata

### Expected Conversation Document
```json
{
  "_id": "conv_789",
  "userId": "usr_12345",
  "context_metadata": {
    "packs_used": [
      {
        "pack_id": "pack:onboarding.basics",
        "selector": "#onboarding + type:document",
        "resolved_at": "2025-10-28T21:30:00Z",
        "bundle_id": "ulid:01J…ST",
        "node_count": 5,
        "token_count": 3200,
        "etag": "sha256:abc123...",
        "policies_applied": ["policy:pii.redact_external"]
      }
    ],
    "total_context_tokens": 3200,
    "drift_checks": [
      {
        "checked_at": "2025-10-29T10:00:00Z",
        "drift_detected": false,
        "current_etag": "sha256:abc123..."
      }
    ]
  }
}
```

This enables:
- Audit trail of context usage
- Drift detection on conversation open
- Usage analytics per pack
- Cost attribution (tokens → API costs)

---

## Example 11: MCP Tool Definition

### Context
PromptOwl dynamically loads MCP tools

Context engine provides `ctx_resolve` tool

### Tool Schema
```json
{
  "name": "ctx_resolve",
  "description": "Resolve context nodes using selector query. Returns relevant documents, snippets, or knowledge based on tags, titles, or saved packs.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "selector": {
        "type": "string",
        "description": "Query string (e.g., '#onboarding + type:document', 'pack:product.basics', '[[Company Overview]]')"
      },
      "max_tokens": {
        "type": "number",
        "description": "Maximum tokens to return (auto-summarize if exceeded)",
        "default": 5000
      },
      "audience": {
        "type": "string",
        "enum": ["internal", "external", "agent"],
        "description": "Audience type (affects policy transforms)",
        "default": "agent"
      }
    },
    "required": ["selector"]
  }
}
```

### Tool Implementation
Server-side handler in `lib/metamcp-tools.ts`:
```typescript
async function executeCtxResolve(params: CtxResolveParams, context: ToolContext) {
  const { selector, max_tokens = 5000, audience = "agent" } = params;

  const bundle = await resolveContext({
    selector,
    actor: `agent:${context.conversationId}`,
    audience,
    maxTokens: max_tokens
  });

  return {
    nodes: bundle.nodes.map(n => ({
      title: n.title,
      content: n.content,
      tokens: n.tokens
    })),
    total_tokens: bundle.totalTokens,
    bundle_id: bundle.bundleId
  };
}
```

---

## Example 12: CLI to PromptOwl Auth Flow

### Context
User wants to sync local vault to PromptOwl

### Action
```bash
ctx login
```

### Expected Result
1. CLI opens browser to PromptOwl OAuth flow
2. User logs in and authorizes CLI access
3. PromptOwl generates API key with scopes: `context:read`, `context:write`, `context:sync`
4. CLI stores credentials in `~/.promptowl/credentials`:
   ```json
   {
     "api_key": "sk_ctx_...",
     "user_id": "usr_12345",
     "expires_at": "2026-10-28T21:45:00Z"
   }
   ```
5. CLI output:
   ```
   ✓ Authenticated as misha@promptowl.ai

   You can now use:
     ctx sync --push    # Upload local changes
     ctx sync --pull    # Download from PromptOwl
   ```

---

## Implementation Notes

### Server Actions
Create in `app/actions/context.ts`:
- `resolveContext()`
- `createContextPack()`
- `listContextPacks()`
- `requestExportApproval()`
- `approveExport()`

### Database Models
New models in `db/models/`:
- `ContextNode` (stores individual context files)
- `ContextPack` (saved selector queries)
- `ContextExportRequest` (approval workflow)
- `ContextExportApproval` (approval records)

Add to existing `Conversation` model:
- `context_metadata` field

### UI Components
New components in `components/ui/`:
- `<ContextPackPicker />` (selector + preview)
- `<ContextPackList />` (pack management)
- `<ContextDriftBadge />` (drift warning)
- `<ExportApprovalDialog />` (approval flow)

### MCP Tool Integration
Add to `lib/metamcp-tools.ts`:
- `ctx_resolve` tool definition
- Handler function with permission checks
- Conversation metadata logging

## Acceptance Criteria
- [ ] Context packs can be added to prompts via UI
- [ ] Agents can call `ctx_resolve` MCP tool
- [ ] CLI sync command uploads/downloads nodes
- [ ] Drift detection shows when packs change
- [ ] Server Actions enforce permissions
- [ ] Export approval workflow functions end-to-end
- [ ] Conversation metadata tracks context usage
- [ ] Token budget warnings prevent overages
- [ ] PromptOwl-native and CLI modes interoperate
- [ ] Audit logs capture all context operations
