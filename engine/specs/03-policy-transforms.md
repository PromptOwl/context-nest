# Specification: Policy Transforms

## Purpose
Define rules that automatically transform context nodes based on audience, scope, or other conditions during resolution/export.

## Principles
1. **Declarative**: Policies are YAML rules, not code
2. **Composable**: Multiple policies can apply to the same node
3. **Traceable**: Manifest records which policies were applied
4. **Testable**: Policies can be dry-run tested before deployment

---

## Example 1: PII Redaction for External Audience

### Context
Policy `policy:pii.redact_external`:
```yaml
id: policy:pii.redact_external
when:
  - audience == "external"
then:
  - transform: "redact_pii"
```

Node `customer-report.md`:
```markdown
Customer: John Doe (john.doe@example.com, SSN: 123-45-6789)
Revenue: $50,000
```

### Action
```bash
ctx resolve "[[Customer Report]]" --audience external
```

### Expected Result
Bundle contains transformed content:
```markdown
Customer: [REDACTED_NAME] ([REDACTED_EMAIL], SSN: [REDACTED_SSN])
Revenue: $50,000
```

Manifest includes:
```yaml
policies_applied:
  - policy:pii.redact_external
```

---

## Example 2: No Transform for Internal Audience

### Context
Same policy and node as Example 1

### Action
```bash
ctx resolve "[[Customer Report]]" --audience internal
```

### Expected Result
Bundle contains **original** content (no redaction):
```markdown
Customer: John Doe (john.doe@example.com, SSN: 123-45-6789)
Revenue: $50,000
```

Manifest includes:
```yaml
policies_applied: []
```

---

## Example 3: Deny Export for Restricted Scope

### Context
Policy `policy:restricted.deny_export`:
```yaml
id: policy:restricted.deny_export
when:
  - scope == "restricted"
then:
  - deny: "export"
```

Node `trade-secret.md`:
```yaml
scope: "restricted"
```

### Action
```bash
ctx export bundle-001.zip --includes trade-secret.md
```

### Expected Result
❌ **Export Denied**
- Error: `Policy violation: policy:restricted.deny_export denies export of node ulid:01J…AB`
- No bundle created

---

## Example 4: Summarization for Token Limits

### Context
Policy `policy:summarize.large_docs`:
```yaml
id: policy:summarize.large_docs
when:
  - node.word_count > 5000
  - audience == "agent"
then:
  - transform: "summarize:1200"
```

Node `architecture-guide.md` (8,000 words)

### Action
```bash
ctx resolve "[[Architecture Guide]]" --audience agent --max-tokens 10000
```

### Expected Result
Bundle contains summarized version (~1,200 words)

Manifest includes:
```yaml
policies_applied:
  - policy:summarize.large_docs
transforms_applied:
  - node: ulid:01J…CD
    transform: summarize:1200
    original_words: 8000
    result_words: 1195
```

---

## Example 5: Multiple Policies on Same Node

### Context
Policies:
```yaml
# Policy 1
id: policy:pii.redact
when: [audience == "external"]
then: [transform: "redact_pii"]

# Policy 2
id: policy:summarize.external
when:
  - audience == "external"
  - node.word_count > 3000
then: [transform: "summarize:1000"]
```

Node `case-study.md` (4,000 words with PII)

### Action
```bash
ctx resolve "[[Case Study]]" --audience external
```

### Expected Result
Bundle contains content that is:
1. First PII-redacted
2. Then summarized to ~1,000 words

Manifest includes:
```yaml
policies_applied:
  - policy:pii.redact
  - policy:summarize.external
transforms_applied:
  - transform: redact_pii
    order: 1
  - transform: "summarize:1000"
    order: 2
```

---

## Example 6: Conditional on Tag

### Context
Policy:
```yaml
id: policy:legal.watermark
when:
  - "#legal" in node.tags
  - audience == "external"
then:
  - transform: "add_watermark"
    params:
      text: "CONFIDENTIAL - DO NOT DISTRIBUTE"
```

Node `contract-template.md` with tags `["#legal", "#template"]`

### Action
```bash
ctx resolve "[[Contract Template]]" --audience external
```

### Expected Result
Bundle contains document with watermark prepended:
```markdown
---
CONFIDENTIAL - DO NOT DISTRIBUTE
---

# Contract Template
...
```

---

## Example 7: Deny if Missing Approval

### Context
Policy:
```yaml
id: policy:export.require_approval
when:
  - operation == "export"
  - scope in ["restricted", "confidential"]
then:
  - require_approval: ["role:compliance"]
```

Node `financial-data.md`:
```yaml
scope: "confidential"
```

### Action
```bash
ctx export bundle-002.zip --actor user:analyst
```

### Expected Result (No Approval)
❌ **Export Blocked**
- Error: `Policy policy:export.require_approval requires approval from role:compliance`
- Creates pending export request at `exports/pending/bundle-002.yml`

### Action (With Approval)
Approval file `exports/pending/bundle-002-approval.yml`:
```yaml
approver: user:compliance_officer
approver_principals: ["role:compliance"]
approved_at: "2025-10-28T20:30:00Z"
```

```bash
ctx export bundle-002.zip --actor user:analyst
```

### Expected Result
✅ **Export Allowed**
- Bundle created with approval metadata in manifest

---

## Example 8: Token Budget Enforcement

### Context
Policy:
```yaml
id: policy:token.limit
when:
  - audience == "agent"
then:
  - enforce_max_tokens: 50000
  - transform: "summarize:auto"
```

Selector resolves to 80,000 tokens worth of content

### Action
```bash
ctx resolve "#onboarding" --audience agent --max-tokens 50000
```

### Expected Result
Bundle contains auto-summarized content fitting within 50k tokens

Manifest includes:
```yaml
policies_applied:
  - policy:token.limit
original_token_count: 80000
final_token_count: 49500
summarization_applied: true
```

---

## Example 9: Conditional Deny Based on Scope

### Context
Policy:
```yaml
id: policy:scope.public_only_external
when:
  - audience == "external"
  - scope != "public"
then:
  - deny: "resolve"
```

Vault contains:
- `public-faq.md`: `scope: "public"`
- `internal-guide.md`: `scope: "team"`

### Action
```bash
ctx resolve "#guide" --audience external
```

### Expected Result
✅ **Partial Success**
- Bundle includes: `public-faq.md`
- Bundle excludes: `internal-guide.md`
- Warning: `Policy policy:scope.public_only_external denied 1 node`

---

## Example 10: Date-Based Expiration

### Context
Policy:
```yaml
id: policy:expiration.old_docs
when:
  - node.age_days > 365
  - "#evergreen" not in node.tags
then:
  - transform: "add_warning"
    params:
      message: "⚠️ This document is over 1 year old. Content may be outdated."
```

Node `2024-roadmap.md` (500 days old, no #evergreen tag)

### Action
```bash
ctx resolve "[[2024 Roadmap]]"
```

### Expected Result
Bundle contains document with warning prepended:
```markdown
⚠️ This document is over 1 year old. Content may be outdated.

# 2024 Roadmap
...
```

---

## Example 11: Chain of Transforms

### Context
Policy defines chained transforms:
```yaml
id: policy:external.sanitize
when: [audience == "external"]
then:
  - transform: "redact_pii"
  - transform: "remove_internal_links"
  - transform: "summarize:2000"
  - transform: "add_disclaimer"
```

Node `customer-case-study.md` (5,000 words with PII and internal links)

### Action
```bash
ctx resolve "[[Customer Case Study]]" --audience external
```

### Expected Result
Bundle contains content processed through all transforms in order:
1. PII redacted
2. Internal `[[links]]` removed
3. Summarized to ~2,000 words
4. Disclaimer added at end

Manifest records transform chain with checksums at each step.

---

## Example 12: Policy Dry Run

### Context
New policy `policy:test.aggressive_redaction`:
```yaml
id: policy:test.aggressive_redaction
when: [audience == "external"]
then:
  - transform: "redact_all_numbers"
```

### Action
```bash
ctx policy test policy:test.aggressive_redaction --fixtures ./tests/fixtures/
```

### Expected Result
Dry run report:
```
Policy: policy:test.aggressive_redaction
Tested against 15 fixtures

✅ 12 fixtures passed
❌ 3 fixtures failed:
  - financial-report.md: Removed critical metric (revenue)
  - timeline.md: Dates removed, unreadable
  - version-history.md: All version numbers removed

Recommendation: Refine redaction rules to preserve non-sensitive numbers.
```

---

## PromptOwl Integration

### Example 13: Org-Level Policy Enforcement

### Context
PromptOwl client "Acme Corp" has org-level policy:
```yaml
id: policy:acme.compliance
client_id: client_acme
when:
  - operation == "export"
  - audience == "external"
then:
  - require_approval: ["role:compliance_officer"]
  - transform: "add_watermark"
    params:
      text: "© Acme Corp - Confidential"
```

### Action
User in Acme Corp exports bundle via UI

### Expected Result
- Export requires compliance approval (approval dialog shown)
- All exported content includes Acme watermark
- Audit log records org policy application

---

## Example 14: Runtime Policy Loading

### Context
PromptOwl loads policies from:
1. Global policies (`/policies/global/`)
2. Org policies (`/policies/client_${clientId}/`)
3. User policies (`/policies/user_${userId}/`)

### Action
`resolveContext()` Server Action called

### Expected Result
Policies applied in precedence order:
1. User policies (highest priority)
2. Org policies
3. Global policies (lowest priority)

Conflicting policies resolved by most specific wins.

---

## Transform Library

### Built-in Transforms
1. `redact_pii`: Removes emails, SSNs, phone numbers, names (NER-based)
2. `summarize:N`: Summarize to ~N words using LLM
3. `summarize:auto`: Adaptive summarization to fit token budget
4. `add_watermark`: Prepend/append text
5. `add_disclaimer`: Append legal disclaimer
6. `remove_internal_links`: Strip `[[wiki-links]]`
7. `add_warning`: Prepend warning message
8. `translate:lang`: Translate to target language

### Custom Transforms (PromptOwl Pro)
Users can define custom transforms using LangChain tools or JS functions.

---

## Implementation Notes

1. **Policy Engine**:
   - Load policies from YAML
   - Parse `when` conditions into AST
   - Evaluate conditions against context (node, audience, operation)
   - Apply `then` actions in order
2. **Transform Registry**:
   - Pluggable transform functions
   - Each transform is idempotent and pure
   - Transforms receive node content + params → return modified content
3. **Checksum Chain**:
   - Record checksum after each transform
   - Enables debugging and rollback
4. **Approval Flow**:
   - `require_approval` creates pending export request
   - Approval file includes approver identity + timestamp
   - Export resumes when valid approval detected

## Acceptance Criteria
- [ ] All 14 examples pass with file-based vault
- [ ] All 14 examples pass with MongoDB-backed vault (PromptOwl mode)
- [ ] Policy dry-run mode works correctly
- [ ] Transform chain preserves checksums
- [ ] Approval flow creates and validates approval files
- [ ] PromptOwl org-level policies override global policies
- [ ] Custom transforms can be registered
- [ ] Manifest records all applied policies and transforms
