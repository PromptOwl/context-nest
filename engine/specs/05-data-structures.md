# Specification: Core Data Structures

## Purpose
Define the canonical data models for context nodes, packs, policies, and manifests with validation rules and examples.

## Principles
1. **Schema-First**: JSON Schema validates all structures
2. **Frontmatter-Friendly**: YAML works in Markdown frontmatter
3. **MongoDB-Compatible**: Maps cleanly to MongoDB documents
4. **Versioned**: All entities track version for evolution

---

## Data Structure 1: Context Node

### Purpose
Represents a single unit of context (document, snippet, glossary, etc.)

### YAML Format (Markdown Frontmatter)
```yaml
---
id: ulid:01JCQM2K7X8PQR5TVWXYZ12345
title: "SEV Management Runbook"
type: "document"
owners: ["team:sre", "user:misha"]
scope: "team"
tags: ["#runbook", "#sev", "#oncall"]
permissions:
  read: ["team:sre", "role:exec_view"]
  write: ["user:misha", "team:sre"]
  export: ["role:compliance", "role:exec"]
version: 3
created_at: "2025-10-15T14:30:00Z"
updated_at: "2025-10-28T21:00:00Z"
derived_from: []
checksum: "sha256:abc123def456..."
metadata:
  word_count: 1250
  token_count: 1680
  last_reviewed: "2025-10-20"
  review_cycle_days: 90
---

# SEV Management Runbook

When a SEV is declared...
```

### JSON Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "title", "type", "owners"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^ulid:[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200
    },
    "type": {
      "type": "string",
      "enum": ["document", "snippet", "glossary", "persona", "policy", "prompt", "tool", "reference"]
    },
    "owners": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^(user|team|role):[a-zA-Z0-9_-]+$"
      },
      "minItems": 1
    },
    "scope": {
      "type": "string",
      "enum": ["user", "team", "org", "public", "restricted", "confidential"],
      "default": "user"
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^#[a-zA-Z0-9_-]+$"
      }
    },
    "permissions": {
      "type": "object",
      "properties": {
        "read": {
          "type": "array",
          "items": { "type": "string" }
        },
        "write": {
          "type": "array",
          "items": { "type": "string" }
        },
        "export": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "version": {
      "type": "integer",
      "minimum": 1
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time"
    },
    "derived_from": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^ulid:[0-9A-HJKMNP-TV-Z]{26}$"
      }
    },
    "checksum": {
      "type": "string",
      "pattern": "^sha256:[a-f0-9]{64}$"
    },
    "metadata": {
      "type": "object"
    }
  }
}
```

### MongoDB Document
```json
{
  "_id": "ulid:01JCQM2K7X8PQR5TVWXYZ12345",
  "userId": "usr_12345",
  "clientId": "client_acme",
  "title": "SEV Management Runbook",
  "type": "document",
  "content": "# SEV Management Runbook\n\nWhen a SEV is declared...",
  "owners": ["team:sre", "user:misha"],
  "scope": "team",
  "tags": ["#runbook", "#sev", "#oncall"],
  "permissions": {
    "read": ["team:sre", "role:exec_view"],
    "write": ["user:misha", "team:sre"],
    "export": ["role:compliance", "role:exec"]
  },
  "version": 3,
  "createdAt": "2025-10-15T14:30:00.000Z",
  "updatedAt": "2025-10-28T21:00:00.000Z",
  "derivedFrom": [],
  "checksum": "sha256:abc123def456...",
  "metadata": {
    "wordCount": 1250,
    "tokenCount": 1680,
    "lastReviewed": "2025-10-20",
    "reviewCycleDays": 90
  },
  "syncedFromCli": false
}
```

### Validation Rules
- ✅ `id` must be unique ULID
- ✅ `owners` must contain at least one principal
- ✅ `tags` must start with `#`
- ✅ `checksum` must be SHA-256 of content
- ✅ `version` increments on every update
- ✅ `permissions.export` defaults to empty (deny-by-default)

---

## Data Structure 2: Context Pack

### Purpose
Saved selector recipe with composition rules

### YAML Format
```yaml
id: pack:onboarding.basics
label: "Onboarding Basics"
description: "Core documents for new hire onboarding"
owner: "team:people_ops"
query: "#onboarding + type:document - #deprecated"
includes:
  - "[[Company Glossary]]"
  - "[[Benefits Overview]]"
excludes:
  - "#internal-only"
filters:
  scope: ["team", "public"]
  before: null
  after: null
post_transforms:
  - transform: "summarize:1200"
    when: "audience == 'agent'"
  - transform: "redact_pii"
    when: "audience == 'external'"
audiences: ["internal", "agent"]
max_tokens: 5000
version: 2
created_at: "2025-09-01T10:00:00Z"
updated_at: "2025-10-28T21:15:00Z"
usage_count: 47
last_used: "2025-10-27T15:30:00Z"
```

### JSON Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "label", "query"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^pack:[a-zA-Z0-9._-]+$"
    },
    "label": {
      "type": "string",
      "minLength": 1
    },
    "description": {
      "type": "string"
    },
    "owner": {
      "type": "string",
      "pattern": "^(user|team|role):[a-zA-Z0-9_-]+$"
    },
    "query": {
      "type": "string",
      "minLength": 1
    },
    "includes": {
      "type": "array",
      "items": { "type": "string" }
    },
    "excludes": {
      "type": "array",
      "items": { "type": "string" }
    },
    "filters": {
      "type": "object",
      "properties": {
        "scope": {
          "type": "array",
          "items": { "type": "string" }
        },
        "before": {
          "type": "string",
          "format": "date"
        },
        "after": {
          "type": "string",
          "format": "date"
        }
      }
    },
    "post_transforms": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["transform"],
        "properties": {
          "transform": { "type": "string" },
          "when": { "type": "string" },
          "params": { "type": "object" }
        }
      }
    },
    "audiences": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["internal", "external", "agent", "public"]
      }
    },
    "max_tokens": {
      "type": "integer",
      "minimum": 100
    },
    "version": {
      "type": "integer",
      "minimum": 1
    }
  }
}
```

### MongoDB Document
```json
{
  "_id": "pack:onboarding.basics",
  "userId": "usr_12345",
  "clientId": "client_acme",
  "label": "Onboarding Basics",
  "description": "Core documents for new hire onboarding",
  "owner": "team:people_ops",
  "query": "#onboarding + type:document - #deprecated",
  "includes": ["[[Company Glossary]]", "[[Benefits Overview]]"],
  "excludes": ["#internal-only"],
  "filters": {
    "scope": ["team", "public"]
  },
  "postTransforms": [
    {
      "transform": "summarize:1200",
      "when": "audience == 'agent'"
    }
  ],
  "audiences": ["internal", "agent"],
  "maxTokens": 5000,
  "version": 2,
  "createdAt": "2025-09-01T10:00:00.000Z",
  "updatedAt": "2025-10-28T21:15:00.000Z",
  "usageCount": 47,
  "lastUsed": "2025-10-27T15:30:00.000Z"
}
```

---

## Data Structure 3: Policy

### Purpose
Declarative rules for transforms, permissions, and approvals

### YAML Format
```yaml
id: policy:pii.redact_external
label: "PII Redaction for External Audiences"
owner: "team:compliance"
priority: 100
when:
  - "audience == 'external'"
  - "scope in ['team', 'org']"
then:
  - action: "transform"
    transform: "redact_pii"
    params:
      preserve_structure: true
  - action: "log"
    level: "info"
    message: "PII redacted for external export"
enabled: true
version: 1
created_at: "2025-08-01T09:00:00Z"
updated_at: "2025-10-28T21:20:00Z"
applies_to:
  operations: ["resolve", "export"]
  node_types: ["document", "snippet"]
  scopes: ["team", "org"]
test_fixtures:
  - "tests/fixtures/customer-report.md"
  - "tests/fixtures/case-study.md"
```

### JSON Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "when", "then"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^policy:[a-zA-Z0-9._-]+$"
    },
    "label": {
      "type": "string"
    },
    "owner": {
      "type": "string"
    },
    "priority": {
      "type": "integer",
      "description": "Higher priority = evaluated first"
    },
    "when": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Array of condition expressions (AND logic)"
    },
    "then": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["action"],
        "properties": {
          "action": {
            "type": "string",
            "enum": ["transform", "deny", "require_approval", "log", "warn"]
          },
          "transform": { "type": "string" },
          "params": { "type": "object" },
          "message": { "type": "string" },
          "level": { "type": "string" }
        }
      }
    },
    "enabled": {
      "type": "boolean",
      "default": true
    },
    "applies_to": {
      "type": "object",
      "properties": {
        "operations": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["resolve", "export", "store"]
          }
        },
        "node_types": {
          "type": "array",
          "items": { "type": "string" }
        },
        "scopes": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  }
}
```

---

## Data Structure 4: Bundle Manifest

### Purpose
Metadata for resolved context bundle (audit + reproducibility)

### YAML Format
```yaml
bundle_id: ulid:01JCQM5N9P2QR6TVWXYZ67890
selector: "#onboarding + [[Brand Guide]] - #deprecated"
resolved_at: "2025-10-28T21:30:00Z"
actor: "agent:web_chat_42"
actor_principals: ["agent:web_chat_42", "team:support"]
audience: "external"
operation: "resolve"
nodes:
  - id: "ulid:01JCQM2K7X8PQR5TVWXYZ12345"
    title: "Getting Started Guide"
    type: "document"
    checksum: "sha256:abc123..."
    tokens: 850
    transforms_applied:
      - "redact_pii"
  - id: "ulid:01JCQM3L8Y9QS7UVXYZ23456"
    title: "Brand Guidelines"
    type: "document"
    checksum: "sha256:def456..."
    tokens: 1200
    transforms_applied: []
policies_applied:
  - policy_id: "policy:pii.redact_external"
    conditions_matched: ["audience == 'external'"]
    actions_taken:
      - action: "transform"
        transform: "redact_pii"
        target_nodes: ["ulid:01JCQM2K7X8PQR5TVWXYZ12345"]
nodes_excluded_by_permission: 0
total_nodes: 2
total_tokens: 2050
hash_tree:
  root: "sha256:root_hash_of_all_nodes..."
  nodes:
    - "sha256:abc123..."
    - "sha256:def456..."
metadata:
  vault_id: "vault:acme_corp"
  vault_version: 42
  cli_version: "1.0.0"
  engine_version: "1.0.0"
```

### JSON Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["bundle_id", "selector", "resolved_at", "actor", "nodes"],
  "properties": {
    "bundle_id": {
      "type": "string",
      "pattern": "^ulid:[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "selector": {
      "type": "string"
    },
    "resolved_at": {
      "type": "string",
      "format": "date-time"
    },
    "actor": {
      "type": "string"
    },
    "actor_principals": {
      "type": "array",
      "items": { "type": "string" }
    },
    "audience": {
      "type": "string",
      "enum": ["internal", "external", "agent", "public"]
    },
    "operation": {
      "type": "string",
      "enum": ["resolve", "export"]
    },
    "nodes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "title", "checksum"],
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "type": { "type": "string" },
          "checksum": { "type": "string" },
          "tokens": { "type": "integer" },
          "transforms_applied": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    },
    "policies_applied": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "total_nodes": {
      "type": "integer"
    },
    "total_tokens": {
      "type": "integer"
    },
    "hash_tree": {
      "type": "object",
      "required": ["root"],
      "properties": {
        "root": { "type": "string" },
        "nodes": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  }
}
```

---

## Data Structure 5: Export Approval

### Purpose
Records approval for context export operations

### YAML Format
```yaml
approval_id: ulid:01JCQM6P0Q3RS8VWXYZ78901
export_request_id: export_req_001
approver: "user:compliance_officer"
approver_principals: ["user:compliance_officer", "role:compliance", "team:legal"]
approved_at: "2025-10-28T21:45:00Z"
expires_at: "2025-10-29T21:45:00Z"
conditions:
  - "Export must include watermark"
  - "Limited to 10 shares maximum"
restrictions:
  max_shares: 10
  allowed_recipients: ["email:*@acme.com"]
  disallow_external: true
notes: "Approved for Q3 board presentation. Must include confidentiality notice."
signature: "sha256:signature_of_approval_data..."
```

### JSON Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["approval_id", "export_request_id", "approver", "approved_at"],
  "properties": {
    "approval_id": {
      "type": "string",
      "pattern": "^ulid:[0-9A-HJKMNP-TV-Z]{26}$"
    },
    "export_request_id": {
      "type": "string"
    },
    "approver": {
      "type": "string"
    },
    "approver_principals": {
      "type": "array",
      "items": { "type": "string" }
    },
    "approved_at": {
      "type": "string",
      "format": "date-time"
    },
    "expires_at": {
      "type": "string",
      "format": "date-time"
    },
    "conditions": {
      "type": "array",
      "items": { "type": "string" }
    },
    "restrictions": {
      "type": "object"
    },
    "notes": {
      "type": "string"
    },
    "signature": {
      "type": "string"
    }
  }
}
```

---

## Implementation Notes

1. **Validation Pipeline**:
   - Parse YAML → Validate against JSON Schema → Transform to MongoDB document
   - Use `ajv` for JSON Schema validation
   - Generate TypeScript types from schemas

2. **Checksum Calculation**:
   - Content only (exclude metadata)
   - Normalize whitespace before hashing
   - SHA-256 with hex encoding

3. **ULID Generation**:
   - Use `ulid` package
   - Monotonic for same-millisecond operations
   - Sortable by creation time

4. **Version Management**:
   - Auto-increment on every `store()` operation
   - Never reuse version numbers
   - Track `derived_from` for lineage

## Acceptance Criteria
- [ ] JSON Schemas validate all example documents
- [ ] YAML ↔ MongoDB transforms are lossless
- [ ] Checksums are deterministic and correct
- [ ] ULIDs are unique and sortable
- [ ] Validation errors are clear and actionable
- [ ] TypeScript types generated from schemas
