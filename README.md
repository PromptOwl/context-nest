# Context Nest

Structured, versioned context for AI agents. Context Nest organizes knowledge as markdown documents in a vault, with versioning, integrity verification, and a query language — accessible via CLI or MCP server.

## Quick Start (npm)

```bash
# Install the CLI globally
npm install -g @promptowl/contextnest-cli

# Create a vault
ctx init --name "My Project Context"
```

## Packages

| Package | npm | License |
|---|---|---|
| [`@promptowl/contextnest-engine`](https://www.npmjs.com/package/@promptowl/contextnest-engine) | `npm i @promptowl/contextnest-engine` | AGPL-3.0 |
| [`@promptowl/contextnest-cli`](https://www.npmjs.com/package/@promptowl/contextnest-cli) | `npm i -g @promptowl/contextnest-cli` | Apache-2.0 |
| [`@promptowl/contextnest-mcp-server`](https://www.npmjs.com/package/@promptowl/contextnest-mcp-server) | `npm i @promptowl/contextnest-mcp-server` | AGPL-3.0 |

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0 (for development from source)

## Installation from Source

```bash
# Clone the repository
git clone https://github.com/PromptOwl/context-nest.git
cd context-nest

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

After building, link the CLI globally (optional):

```bash
cd packages/cli
pnpm link --global
```

This makes the `ctx` command available system-wide.

## Project Structure

```
context-nest/
├── packages/
│   ├── engine/        # Core library — parsing, storage, versioning, integrity
│   ├── cli/           # Command-line tool (`ctx`)
│   └── mcp-server/    # MCP server for AI agent access
├── fixtures/
│   └── minimal-vault/ # Example vault for reference and testing
└── CONTEXT_NEST_SPEC.md   # Specification (see github.com/PromptOwl/context-nest-spec)
```

---

## Setting Up a Vault

### 1. Initialize a new vault

```bash
ctx init --name "My Project Context"
```

This creates the default **structured** layout:

```
my-vault/
├── CONTEXT.md              # Vault identity & AI operating instructions
├── .context/
│   └── config.yaml         # Vault configuration
├── nodes/                  # Documents, snippets, glossaries, etc.
├── sources/                # Source nodes (live data connectors)
└── packs/                  # Context packs (saved queries)
```

Use `--layout obsidian` for a flat Obsidian-compatible layout.

### 2. Configure the vault

Edit `.context/config.yaml` to register MCP servers and set defaults:

```yaml
version: 1
name: "My Project Context"
description: "Project knowledge base for AI agents"
defaults:
  status: draft
folders:
  nodes:
    description: "Project documents"
  sources:
    description: "Live data sources"
servers:
  jira:
    url: "https://mcp.atlassian.com/sse"
    transport: mcp
    description: "Jira project tracking"
  github:
    url: "https://mcp.github.com/sse"
    transport: mcp
    description: "GitHub repository data"
```

### 3. Edit CONTEXT.md

`CONTEXT.md` is the vault's identity file. It tells AI agents what this vault is and how to use it:

```markdown
---
title: "My Project Context"
---

# My Project Context

Knowledge base for the Acme platform.

## Operating Instructions

- Always cite sources by document path
- Prefer published documents over drafts
- Check source nodes for live data before using cached info
```

### 4. Add documents

```bash
ctx add nodes/api-design --title "API Design Guidelines" --type document
```

This creates `nodes/api-design.md` with a frontmatter template. Edit the file to add content:

```markdown
---
title: "API Design Guidelines"
type: document
tags:
  - "#engineering"
  - "#api"
status: draft
version: 1
author: you@example.com
created_at: 2025-01-15T10:00:00Z
---

# API Design Guidelines

All endpoints use REST conventions. See
[Architecture Overview](contextnest://nodes/architecture-overview) for context.
```

### 5. Add source nodes

Source nodes connect to live data via MCP servers or other transports:

```markdown
---
title: "Current Sprint Tickets"
type: source
tags:
  - "#engineering"
  - "#sprint"
status: published
version: 1
source:
  transport: mcp
  server: jira
  tools:
    - jira_get_active_sprint
    - jira_get_sprint_issues
  cache_ttl: 300
---

# Current Sprint Tickets

Call `jira_get_active_sprint` to get the current sprint,
then `jira_get_sprint_issues` to list all tickets.
```

### 6. Add context packs

Packs are saved queries in `packs/` as YAML files:

```yaml
# packs/onboarding-basics.yml
id: onboarding.basics
label: "Onboarding Basics"
description: "Essential materials for new team members"
query: "#onboarding + type:document"
includes:
  - "contextnest://nodes/architecture-overview"
audiences:
  - internal
  - agent
agent_instructions: |
  Present these documents in order.
  Start with the architecture overview.
```

---

## CLI Usage

Set the vault path (defaults to current directory):

```bash
export CONTEXTNEST_VAULT_PATH=/path/to/your/vault
```

Or run commands from within the vault directory.

### Document Management

| Command | Description |
|---|---|
| `ctx init` | Initialize a new vault |
| `ctx add <path>` | Create a new document (auto-publishes and regenerates index) |
| `ctx update <path>` | Update a document's title, tags, or body (auto-publishes and regenerates index) |
| `ctx delete <path>` | Delete a document and its version history (regenerates index) |
| `ctx validate [path]` | Validate documents against the spec |
| `ctx publish <path>` | Publish a document (creates version + checkpoint, regenerates index) |

```bash
# Create a document with tags
ctx add nodes/api-design --title "API Design Guidelines" --tags "engineering,api"

# Update a document
ctx update nodes/api-design --title "New Title" --tags "api,v2" --body "Updated content"

# Delete a document
ctx delete nodes/api-design

# Validate all documents
ctx validate

# Publish a document explicitly
ctx publish nodes/api-design --author "you@example.com" --message "Initial release"
```

### Querying & Search

| Command | Description |
|---|---|
| `ctx list` | List all documents with optional type/status/tag filters |
| `ctx search <query>` | Full-text search across vault documents |
| `ctx resolve <selector>` | Execute a selector query |
| `ctx inject <selector>` | Resolve context for agent consumption |

```bash
# List all published documents
ctx list --status published

# List documents by tag
ctx list --tag engineering

# Full-text search
ctx search "API design"

# Find by tag with selector
ctx resolve '#engineering'

# Combine filters
ctx resolve '#engineering + type:document'

# Boolean OR
ctx resolve '#api | #architecture'

# Exclude
ctx resolve '#engineering - status:draft'

# Pack query
ctx resolve 'pack:onboarding.basics'
```

### Version History

| Command | Description |
|---|---|
| `ctx history <path>` | Show version history |
| `ctx reconstruct <path> <version>` | Reconstruct a specific version |
| `ctx verify` | Verify integrity of all hash chains |

```bash
# View history
ctx history nodes/api-design

# Reconstruct version 2
ctx reconstruct nodes/api-design 2

# Verify all hash chains
ctx verify
```

### Index & Packs

| Command | Description |
|---|---|
| `ctx index` | Regenerate context.yaml and INDEX.md files |
| `ctx pack list` | List all context packs |
| `ctx pack show <id>` | Show pack details |
| `ctx checkpoint list` | List checkpoints |
| `ctx checkpoint rebuild` | Rebuild checkpoint history |

---

## MCP Server

The MCP server exposes vault operations as tools for AI agents over stdio transport.

### Running the server directly

```bash
# Build first
pnpm build

# Run with vault path as argument
node packages/mcp-server/dist/index.js /path/to/your/vault

# Or via environment variable
CONTEXTNEST_VAULT_PATH=/path/to/your/vault node packages/mcp-server/dist/index.js
```

### Configuring with Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "contextnest": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "CONTEXTNEST_VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

### Configuring with Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "contextnest": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "CONTEXTNEST_VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

### Available MCP Tools

**Read tools:**

| Tool | Description |
|---|---|
| `vault_info` | Get vault identity and configuration summary |
| `resolve` | Execute a selector query |
| `read_document` | Read a document by URI or path |
| `list_documents` | List documents with optional type/status/tag filters |
| `read_index` | Return the context.yaml index |
| `read_pack` | Resolve and return a context pack with documents |
| `search` | Full-text search across vault documents |
| `verify_integrity` | Verify all hash chains |
| `list_checkpoints` | List recent checkpoints |
| `read_version` | Read a specific version of a document |

**Mutation tools** (all auto-publish and regenerate the index):

| Tool | Description |
|---|---|
| `create_document` | Create a new document with frontmatter and optional body |
| `update_document` | Update a document's title, tags, status, or body |
| `delete_document` | Delete a document and its version history |
| `publish_document` | Explicitly publish a document (bump version, create checkpoint) |

---

## Development

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type-check without emitting
pnpm lint

# Clean all build artifacts
pnpm clean
```

## Typical Workflow

```
ctx init                          # 1. Create a vault
                                  # 2. Edit CONTEXT.md and config.yaml
ctx add nodes/my-doc              # 3. Add documents (auto-publishes & indexes)
ctx update nodes/my-doc --title X # 4. Update as needed (auto-publishes & indexes)
ctx validate                      # 5. Validate
ctx verify                        # 6. Verify integrity
                                  # 7. Start MCP server for AI access
```

## License

- **Engine** ([`@promptowl/contextnest-engine`](https://www.npmjs.com/package/@promptowl/contextnest-engine)): AGPL-3.0
- **MCP Server** ([`@promptowl/contextnest-mcp-server`](https://www.npmjs.com/package/@promptowl/contextnest-mcp-server)): AGPL-3.0
- **CLI** ([`@promptowl/contextnest-cli`](https://www.npmjs.com/package/@promptowl/contextnest-cli)): Apache-2.0
- **Specification**: Apache-2.0 — see [context-nest-spec](https://github.com/PromptOwl/context-nest-spec)
