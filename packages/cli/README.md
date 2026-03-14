# @promptowl/contextnest-cli

Command-line tool for [Context Nest](https://github.com/PromptOwl/context-nest) — structured, versioned context vaults for AI agents.

## Install

```bash
npm install -g @promptowl/contextnest-cli
```

## Quick Start

```bash
# Initialize a vault with a starter recipe
ctx init --starter developer

# See all available starters
ctx init --list-starters

# Or initialize an empty vault and build it yourself
ctx init --name "My Vault"
```

### Available Starters

| Recipe | For | What You Get |
|--------|-----|-------------|
| `developer` | Engineering teams | Architecture, API reference, dev setup |
| `executive` | Leadership | Strategic vision, market landscape, decision log |
| `analyst` | Research / OSINT | Case files, source registry, methodology |
| `team` | General teams | Handbook, onboarding guide, runbook |

## Commands

### Document Management
- `ctx add <path>` — Create a new document
- `ctx update <path>` — Update a document
- `ctx delete <path>` — Delete a document
- `ctx publish <path>` — Publish (bump version, create checkpoint)
- `ctx validate [path]` — Validate against the spec
- `ctx list` — List documents (filter by `--type`, `--status`, `--tag`)
- `ctx search <query>` — Full-text search

### Context Injection
- `ctx inject <selector>` — Resolve context for AI agent consumption
- `ctx inject @org/pack` — Inject from a cloud-hosted pack
- `ctx resolve <selector>` — Execute a selector query

### Versioning & Integrity
- `ctx history <path>` — Show version history
- `ctx reconstruct <path> <version>` — Reconstruct a specific version
- `ctx verify` — Verify all hash chains

### Packs & Checkpoints
- `ctx pack list` — List context packs
- `ctx pack show <id>` — Show pack details
- `ctx checkpoint list` — List checkpoints
- `ctx checkpoint rebuild` — Rebuild checkpoint history

### Index
- `ctx index` — Regenerate context.yaml and INDEX.md files

## Selectors

```bash
ctx inject "tag:#engineering"              # All docs with a tag
ctx inject "type:document"                 # All docs of a type
ctx inject "path:nodes/api-*"             # Glob match
ctx inject "pack:engineering-essentials"   # All docs in a pack
ctx inject "status:published"             # By status
ctx inject "tag:#api + tag:#v2"           # Union
ctx inject "tag:#api & status:published"  # Intersection
```

## Cloud Packs

Inject context from cloud-hosted packs without downloading source files:

```bash
ctx inject @promptowl/executive-ai-strategy
```

## Links

- [Context Nest repo](https://github.com/PromptOwl/context-nest)
- [PromptOwl](https://promptowl.com)

## License

Apache-2.0
