# Specification: Selector Grammar

## Purpose
Define how users compose queries to select context nodes using a flexible, configurable syntax.

## Principles
1. **Readable**: Selectors should read like natural language
2. **Composable**: Combine multiple selection criteria with operators
3. **Configurable**: Token syntax can be customized per vault (Obsidian vs Owlpad)
4. **Deterministic**: Same selector + vault state = same results

---

## Example 1: Select by Tag

### Context
Vault contains:
- `onboarding-overview.md` with `tags: ["#onboarding", "#public"]`
- `onboarding-internal.md` with `tags: ["#onboarding", "#internal"]`
- `security-policy.md` with `tags: ["#security"]`

### Action
```bash
ctx resolve "#onboarding"
```

### Expected Result
Bundle contains:
- `onboarding-overview.md`
- `onboarding-internal.md`

Bundle excludes:
- `security-policy.md`

---

## Example 2: Select by Title Transclusion

### Context
Vault contains:
- `Brand Guidelines.md` with `title: "Brand Guidelines"`
- `Brand One-Pager.md` with `title: "Brand One-Pager"`

### Action
```bash
ctx resolve "[[Brand One-Pager]]"
```

### Expected Result
Bundle contains exactly:
- `Brand One-Pager.md`

---

## Example 3: Composition with AND (+)

### Context
Vault contains:
- `doc-a.md`: `tags: ["#onboarding", "#external"]`
- `doc-b.md`: `tags: ["#onboarding"]`
- `doc-c.md`: `tags: ["#external"]`

### Action
```bash
ctx resolve "#onboarding + #external"
```

### Expected Result
Bundle contains:
- `doc-a.md` (has both tags)

Bundle excludes:
- `doc-b.md` (missing #external)
- `doc-c.md` (missing #onboarding)

---

## Example 4: Exclusion with NOT (-)

### Context
Vault contains:
- `current-guide.md`: `tags: ["#guide"]`
- `old-guide.md`: `tags: ["#guide", "#deprecated"]`

### Action
```bash
ctx resolve "#guide - #deprecated"
```

### Expected Result
Bundle contains:
- `current-guide.md`

Bundle excludes:
- `old-guide.md`

---

## Example 5: Owner Scoping

### Context
Vault contains:
- `legal-template.md`: `owners: ["team:legal"]`, `title: "Contract Template"`
- `eng-runbook.md`: `owners: ["team:engineering"]`, `title: "Contract Template"`

### Action
```bash
ctx resolve "@legal/Contract Template"
```

### Expected Result
Bundle contains:
- `legal-template.md` (matches owner + title)

Bundle excludes:
- `eng-runbook.md` (different owner)

---

## Example 6: Type Filtering

### Context
Vault contains:
- `glossary.md`: `type: "glossary"`, `tags: ["#product"]`
- `guide.md`: `type: "document"`, `tags: ["#product"]`

### Action
```bash
ctx resolve "#product type:glossary"
```

### Expected Result
Bundle contains:
- `glossary.md`

Bundle excludes:
- `guide.md` (wrong type)

---

## Example 7: Saved Pack Reference

### Context
Pack definition in `packs/onboarding-basics.yml`:
```yaml
id: pack:onboarding.basics
query: "#onboarding + type:document"
```

Vault contains:
- `intro.md`: `type: "document"`, `tags: ["#onboarding"]`
- `glossary.md`: `type: "glossary"`, `tags: ["#onboarding"]`

### Action
```bash
ctx resolve "pack:onboarding.basics"
```

### Expected Result
Bundle contains:
- `intro.md` (matches pack query)

Bundle excludes:
- `glossary.md` (type mismatch)

---

## Example 8: Complex Composition

### Context
Pack `pack:onboarding.basics` exists (includes #onboarding docs)

Vault contains:
- `brand.md`: `title: "Brand One-Pager"`
- `old-doc.md`: `tags: ["#onboarding", "#deprecated"]`
- `intro.md`: `tags: ["#onboarding"]`

### Action
```bash
ctx resolve "pack:onboarding.basics + [[Brand One-Pager]] - #deprecated"
```

### Expected Result
Bundle contains:
- `intro.md` (from pack, not deprecated)
- `brand.md` (added by title)

Bundle excludes:
- `old-doc.md` (excluded by #deprecated)

---

## Example 9: Date Range Filtering

### Context
Vault contains:
- `q1-report.md`: `created_at: "2025-03-15"`
- `q2-report.md`: `created_at: "2025-06-20"`

### Action
```bash
ctx resolve "type:document before:2025-06-01"
```

### Expected Result
Bundle contains:
- `q1-report.md`

Bundle excludes:
- `q2-report.md` (too recent)

---

## Example 10: Scope Filtering

### Context
Vault contains:
- `public-faq.md`: `scope: "public"`
- `team-guide.md`: `scope: "team"`
- `personal-notes.md`: `scope: "user"`

### Action
```bash
ctx resolve "#guide scope:team"
```

### Expected Result
Bundle contains only:
- `team-guide.md` (if tagged #guide)

---

## Configurable Syntax

### Owlpad Custom Syntax
Config in `syntax.yml`:
```yaml
tokens:
  title_transclusion: "(({{title}}))"  # Instead of [[title]]
  tag: "@{{tag}}"                      # Instead of #tag
  owner_scope: "~{{owner}}/{{title}}"  # Instead of @owner/title
```

### Action
```bash
ctx resolve "@onboarding + ((Brand Guide))"
```

### Expected Result
Same behavior as standard syntax, using custom token patterns.

---

## Error Cases

### Example 11: Invalid Pack Reference

### Action
```bash
ctx resolve "pack:nonexistent.pack"
```

### Expected Result
Error: `Pack not found: pack:nonexistent.pack`

### Example 12: Ambiguous Title

### Context
Vault contains two files with `title: "Setup Guide"`

### Action
```bash
ctx resolve "[[Setup Guide]]"
```

### Expected Result
Error: `Ambiguous title reference: "Setup Guide" matches 2 nodes. Use @owner/title to disambiguate.`

---

## Implementation Notes

1. **Parser**: Tokenize selector string into AST
2. **Evaluator**: Walk AST and apply filters to vault index
3. **Composition**:
   - `+` (AND): intersection of result sets
   - `|` (OR): union of result sets
   - `-` (NOT): difference of result sets
4. **Precedence**: Evaluate left-to-right, parentheses for grouping
5. **Index**: Pre-build in-memory map of `id → metadata` for fast filtering

## Acceptance Criteria
- [ ] All 12 examples pass with file-based vault
- [ ] All 12 examples pass with MongoDB-backed vault (PromptOwl mode)
- [ ] Syntax can be overridden via `syntax.yml`
- [ ] Invalid selectors return clear error messages
- [ ] Selector parsing is deterministic (same input = same AST)
