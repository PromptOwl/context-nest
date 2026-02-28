# Context Nest Specification v1.0

**Status**: Draft
**Compatible with**: Obsidian, PromptOwl, any markdown editor
**File Extension**: `.md` (standard markdown)

## Overview

Context Nest is an open specification for organizing knowledge as portable markdown files with YAML frontmatter. It is designed to be:

- **Self-contained**: Works with any text editor, no tools required
- **Obsidian-compatible**: Uses standard Obsidian syntax for links, tags, and frontmatter
- **Tool-enhanced**: PromptOwl, Obsidian, and other tools can add rich features
- **AI-agent friendly**: Structured for programmatic access and LLM context injection

## Directory Structure

```
my-context-nest/
├── .context/                    # Configuration directory
│   ├── config.yaml              # Nest configuration
│   └── stewards.yaml            # Stewardship/permissions
├── INDEX.md                     # Root index (auto-generated)
├── engineering/
│   ├── INDEX.md                 # Folder index (auto-generated)
│   ├── api-design.md
│   └── architecture.md
├── product/
│   ├── INDEX.md
│   └── roadmap.md
└── decisions/
    ├── INDEX.md
    └── adr-001-database-choice.md
```

## Document Format

### YAML Frontmatter

Every document MUST have YAML frontmatter at the top:

```yaml
---
id: "doc_abc123"                    # Unique identifier (optional for new docs)
title: "API Design Guidelines"      # Document title (required)
tags:
  - engineering
  - api
  - guidelines
status: approved                    # draft | pending_review | approved | rejected
version: 3                          # Current version number
created: 2024-01-15T10:30:00Z       # ISO 8601 timestamp
updated: 2024-02-01T14:22:00Z       # ISO 8601 timestamp
author: john.doe@example.com        # Original author email
owner: jane.smith@example.com       # Current owner email (optional)
approved_by: tech.lead@example.com  # Approver email (if approved)
approved_at: 2024-01-20T09:00:00Z   # Approval timestamp (if approved)
approved_version: 2                 # Which version was approved
---
```

#### Required Fields
- `title`: Human-readable document title

#### Optional Fields
- `id`: Unique identifier (generated on import if missing)
- `tags`: Array of tag names (without # prefix)
- `status`: Lifecycle status (default: `draft`)
- `version`: Version number (default: 1)
- `created`: Creation timestamp (default: file creation time)
- `updated`: Last update timestamp (default: file modification time)
- `author`: Original author email
- `owner`: Current owner/responsible party email
- `approved_by`: Email of approver
- `approved_at`: Approval timestamp
- `approved_version`: Version number that was approved

### Markdown Body

Standard markdown with these Obsidian-compatible extensions:

#### Wiki Links
```markdown
See [[API Design Guidelines]] for more details.
See [[API Design Guidelines|the API docs]] for aliased link.
```

**Syntax**: `[[page-title]]` or `[[page-title|display-text]]`

#### Tags
```markdown
This document covers #api and #security topics.
```

**Syntax**: `#tag-name` (alphanumeric, hyphens, underscores)

#### Mentions
```markdown
Assigned to @john.doe for review.
The @team:engineering should be aware.
```

**Syntax**: `@username` or `@team:teamname`

#### Tasks
```markdown
- [ ] Incomplete task
- [x] Completed task
- [ ] Task assigned to @john.doe
```

**Syntax**: Standard GFM task list syntax

## Configuration Files

### .context/config.yaml

```yaml
# Context Nest Configuration
version: 1
name: "Engineering Knowledge Base"
description: "Technical documentation and decisions"

# Default settings for new documents
defaults:
  status: draft
  require_approval: true

# Folder configurations
folders:
  engineering:
    description: "Technical documentation"
    require_approval: true
  decisions:
    description: "Architecture Decision Records"
    require_approval: true
    template: adr

# Export settings (for PromptOwl sync)
sync:
  promptowl_data_room_id: "dr_abc123"  # Optional: linked data room
  auto_index: true                      # Auto-generate INDEX.md files
```

### .context/stewards.yaml

Portable permissions that work independently of any tool:

```yaml
# Stewardship Configuration
version: 1

# Data room level stewards (can approve anything)
data_room:
  - email: tech.lead@example.com
    can_approve: true
    can_reject: true
    can_delegate: true

# Folder-level stewards
folders:
  engineering:
    - email: senior.dev@example.com
      can_approve: true
      can_reject: true
    - email: architect@example.com
      can_approve: true
      can_reject: true
      can_delegate: true

  decisions:
    - email: architect@example.com
      can_approve: true
      can_reject: true
      can_delegate: true

# Tag-level stewards (steward for all docs with this tag)
tags:
  security:
    - email: security.lead@example.com
      can_approve: true
      can_reject: true

  api:
    - email: api.team@example.com
      can_approve: true

# Document-level stewards (override folder/tag stewards)
documents:
  "API Design Guidelines":
    - email: api.lead@example.com
      can_approve: true
      can_reject: true
```

## INDEX.md Format

INDEX.md files are auto-generated summaries of folder contents:

```markdown
---
title: "Engineering Index"
type: index
auto_generated: true
generated_at: 2024-02-01T14:22:00Z
---

# Engineering

Technical documentation and architecture decisions.

## Documents

| Document | Status | Tags | Updated |
|----------|--------|------|---------|
| [[API Design Guidelines]] | approved | #api #guidelines | 2024-02-01 |
| [[Architecture Overview]] | draft | #architecture | 2024-01-28 |

## Subfolders

- [[engineering/decisions/INDEX|Decisions]] - Architecture Decision Records

## Statistics

- Total documents: 2
- Approved: 1
- Pending review: 0
- Draft: 1

## Tags in this folder

#api #architecture #guidelines
```

## File Naming Conventions

- Use kebab-case for file names: `api-design-guidelines.md`
- Title in frontmatter can have spaces: `title: "API Design Guidelines"`
- Wiki links use title, not filename: `[[API Design Guidelines]]`
- Resolution: title -> filename fallback

## Version History (Optional)

For tools that support versioning, include a `.versions/` folder:

```
my-context-nest/
├── engineering/
│   ├── api-design.md              # Current version
│   └── .versions/
│       └── api-design/
│           ├── v1.md              # Version 1
│           ├── v2.md              # Version 2
│           └── history.yaml       # Version metadata
```

### .versions/api-design/history.yaml

```yaml
versions:
  - version: 1
    edited_by: john.doe@example.com
    edited_at: 2024-01-15T10:30:00Z
    note: "Initial draft"
  - version: 2
    edited_by: jane.smith@example.com
    edited_at: 2024-01-18T11:00:00Z
    note: "Added authentication section"
  - version: 3
    edited_by: john.doe@example.com
    edited_at: 2024-02-01T14:22:00Z
    note: "Updated rate limiting guidance"
```

## Compatibility Notes

### Obsidian Compatibility

- Frontmatter: Fully compatible with Obsidian Properties
- Wiki links: Standard `[[page]]` and `[[page|alias]]` syntax
- Tags: Standard `#tag` syntax (Obsidian prefers no # in frontmatter tags)
- Tasks: Standard GFM checkbox syntax

### PromptOwl Compatibility

When imported to PromptOwl:
- `id` field preserved or generated
- Stewards from `stewards.yaml` mapped to PromptOwl stewardship
- Version history imported if present
- Approval status preserved

### Git Compatibility

- All files are plain text, diff-friendly
- `.context/` folder should be committed
- `.versions/` folder optional (PromptOwl can reconstruct from git history)

## MIME Type

Suggested MIME type for Context Nest documents:
`text/markdown; variant=context-nest`

## Validation

A valid Context Nest document:
1. Has valid YAML frontmatter (between `---` delimiters)
2. Has a `title` field in frontmatter
3. Body is valid markdown
4. Wiki links reference existing documents or are marked as broken
5. Tags match the allowed pattern: `^[a-zA-Z][a-zA-Z0-9_-]*$`

## Extension Points

Tools may extend the spec with:
- Additional frontmatter fields (prefixed with tool name: `promptowl_feature: value`)
- Additional config in `.context/` (e.g., `.context/promptowl.yaml`)
- Custom INDEX.md sections

## Examples

### Minimal Document

```markdown
---
title: "Quick Note"
---

This is a quick note about something important.
```

### Full Document

```markdown
---
id: "doc_abc123"
title: "API Design Guidelines"
tags:
  - engineering
  - api
  - guidelines
status: approved
version: 3
created: 2024-01-15T10:30:00Z
updated: 2024-02-01T14:22:00Z
author: john.doe@example.com
owner: jane.smith@example.com
approved_by: tech.lead@example.com
approved_at: 2024-01-20T09:00:00Z
approved_version: 2
---

# API Design Guidelines

These guidelines establish standards for REST API design.

## Related Documents

- [[Architecture Overview]]
- [[Security Guidelines]]

## Owners

Maintained by @jane.smith with oversight from @team:engineering.

## Tasks

- [x] Define versioning strategy
- [x] Document error response format
- [ ] Add rate limiting section @john.doe

#api #guidelines #engineering
```
