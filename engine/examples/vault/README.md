# Example Vault

This is a sample context vault demonstrating the Context Engine capabilities.

## Structure

```
vault/
├── nodes/              # Context nodes (Markdown files with YAML frontmatter)
│   ├── sev-runbook.md
│   ├── onboarding-overview.md
│   ├── brand-guidelines.md
│   └── company-glossary.md
├── packs/              # Saved selector queries
│   └── onboarding-basics.yml
├── policies/           # Governance rules
│   └── pii-redact-external.yml
├── actors.yml          # Principal mappings for permission checks
└── syntax.yml          # Selector syntax configuration
```

## Example Nodes

### sev-runbook.md
- **Type**: document
- **Scope**: team
- **Tags**: #runbook, #sev, #oncall
- **Permissions**: SRE team + executives (read), compliance (export)
- Demonstrates: Restricted permissions, role-based access

### onboarding-overview.md
- **Type**: document
- **Scope**: team
- **Tags**: #onboarding, #public
- **Permissions**: Public read, exports allowed
- Demonstrates: Wildcard permissions, internal links

### brand-guidelines.md
- **Type**: document
- **Scope**: public
- **Tags**: #brand, #public, #design
- **Permissions**: Public read/export, marketing team (write)
- Demonstrates: Public content, rich formatting

### company-glossary.md
- **Type**: glossary
- **Scope**: team
- **Tags**: #glossary, #reference
- **Permissions**: Public read, people ops (write)
- Demonstrates: Glossary type, reference material

## Example Selectors

Try these selector queries:

### Basic Tag Selection
```bash
ctx resolve "#onboarding"
# Returns: onboarding-overview.md
```

### Title Transclusion
```bash
ctx resolve "[[Company Glossary]]"
# Returns: company-glossary.md
```

### Composition
```bash
ctx resolve "#onboarding + #public"
# Returns: onboarding-overview.md (has both tags)
```

### Type Filtering
```bash
ctx resolve "#reference type:glossary"
# Returns: company-glossary.md
```

### Pack Reference
```bash
ctx resolve "pack:onboarding.basics"
# Returns: All nodes matching the pack query
```

### Complex Query
```bash
ctx resolve "(#onboarding | #brand) + #public"
# Returns: onboarding-overview.md, brand-guidelines.md
```

## Example Packs

### onboarding.basics
- **Query**: `#onboarding + type:document - #deprecated`
- **Includes**: Company Glossary, Brand Guidelines
- **Transforms**: Summarize for agents, redact PII for external
- **Max Tokens**: 5000
- Demonstrates: Pack composition, post-transforms, token limits

## Example Policies

### pii.redact_external
- **When**: `audience == 'external'` AND `scope in ['team', 'org']`
- **Then**: Transform with `redact_pii`, log action
- **Priority**: 100
- **Applies To**: resolve & export operations on documents/snippets
- Demonstrates: Conditional transforms, audience-based rules

## Actors & Permissions

### Users
- **user:misha**: SRE + Engineering + Admin
- **user:alice**: Engineering + Developer
- **user:compliance_officer**: Legal + Compliance + Admin

### Agents
- **agent:web_chat_42**: Support team permissions
- **agent:trusted_bot**: Basic agent access
- **agent:research_assistant**: Research team permissions

## Testing Permission Scenarios

### Scenario 1: Allowed Access
```bash
ctx resolve "[[SEV Management Runbook]]" --actor user:misha
# ✅ Allowed: misha is in team:sre
```

### Scenario 2: Denied Access
```bash
ctx resolve "[[SEV Management Runbook]]" --actor user:alice
# ❌ Denied: alice is not in team:sre or role:exec_view
```

### Scenario 3: Partial Access
```bash
ctx resolve "#guide" --actor user:alice
# ✅ Returns only nodes alice has permission to read
# Excludes restricted nodes in bundle metadata
```

### Scenario 4: Export Restriction
```bash
ctx export bundle-001.zip --actor user:alice
# ❌ Denied: Export permissions are default-deny
```

## Syntax Configuration

The `syntax.yml` file uses Obsidian-style syntax by default:
- Title: `[[Title]]`
- Tag: `#tag`
- Owner: `@owner/title`
- Pack: `pack:id`

To use Owlpad syntax, edit `syntax.yml`:
```yaml
tokens:
  title_transclusion: "(({{title}}))"
  tag: "@{{tag}}"
  owner_scope: "~{{owner}}/{{title}}"
  pack_reference: "bundle:{{pack_id}}"
```

## Next Steps

1. **Validate**: `ctx validate` - Check all frontmatter
2. **Explore**: Try different selector queries
3. **Add Nodes**: Create your own `.md` files with frontmatter
4. **Create Packs**: Save common queries in `packs/`
5. **Define Policies**: Add governance rules in `policies/`

## Tips

- All node IDs must be valid ULIDs (starts with `ulid:`)
- Tags must start with `#`
- Checksums use SHA-256 format: `sha256:...`
- Dates must be ISO 8601: `2025-10-28T21:00:00Z`
- Principals format: `type:name` (e.g., `user:alice`, `team:eng`, `role:admin`)

## Resources

- [Selector Grammar Spec](../../specs/01-selector-grammar.md)
- [Permission Checks Spec](../../specs/02-permission-checks.md)
- [Policy Transforms Spec](../../specs/03-policy-transforms.md)
- [Project Summary](../../PROJECT_SUMMARY.md)
