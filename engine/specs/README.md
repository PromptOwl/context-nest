# Context Engine Specifications

This directory contains **Specification by Example** documents that define the Context Engine's behavior through concrete, testable examples.

## Purpose

These specifications serve multiple audiences:
- **Developers**: Understand requirements through examples before writing code
- **Product Managers**: Validate features match business requirements
- **QA Engineers**: Use examples as acceptance test cases
- **Users**: Learn how features work through real scenarios

## Specification Structure

Each spec follows the pattern:

1. **Purpose**: What capability does this spec define?
2. **Principles**: Core design tenets (e.g., "Default Deny", "Declarative")
3. **Examples**: Concrete scenarios with:
   - **Context**: Given state/setup
   - **Action**: What the user/system does
   - **Expected Result**: Observable outcome
4. **Implementation Notes**: Technical guidance for developers
5. **Acceptance Criteria**: Checklist for completion

## Specifications Index

### [01-selector-grammar.md](./01-selector-grammar.md)
**Covers**: Query syntax for selecting context nodes

**Key Examples**:
- Tag-based selection (`#onboarding`)
- Title transclusion (`[[Brand Guidelines]]`)
- Composition operators (`+`, `-`, `|`)
- Owner scoping (`@legal/Contract Template`)
- Saved pack references (`pack:onboarding.basics`)
- Complex queries with filters and exclusions
- Custom syntax configuration (Obsidian/Owlpad compatibility)

**Gherkin Feature**: `features/01-selector-resolution.feature`

---

### [02-permission-checks.md](./02-permission-checks.md)
**Covers**: ABAC permission model for read/write/export operations

**Key Examples**:
- Principal matching (user, team, role, agent)
- Permission inheritance and hierarchies
- Default deny behavior
- Export-specific permissions
- Partial access (some nodes allowed, others denied)
- Wildcard permissions
- NextAuth session mapping for PromptOwl
- Audit trail generation

**Gherkin Feature**: `features/02-permission-enforcement.feature`

---

### [03-policy-transforms.md](./03-policy-transforms.md)
**Covers**: Declarative policies for content transformation and governance

**Key Examples**:
- PII redaction for external audiences
- Auto-summarization for token limits
- Export approval workflows
- Conditional transforms (date-based, scope-based)
- Policy chaining (multiple transforms in order)
- Dry-run testing of policies
- Org-level policy enforcement in PromptOwl
- Custom transforms (Pro feature)

**Gherkin Feature**: `features/03-policy-transforms.feature`

---

### [04-promptowl-integration.md](./04-promptowl-integration.md)
**Covers**: Seamless integration with PromptOwl UI, workflows, and MCP tools

**Key Examples**:
- Context pack picker in prompt editor
- MCP tool for agent context resolution
- CLI ↔ PromptOwl sync (push/pull)
- Drift detection on pack changes
- Server Actions for context operations
- Export approval UI
- Token budget warnings
- Conversation metadata tracking
- Usage analytics

**Gherkin Feature**: `features/04-promptowl-integration.feature`

---

### [05-data-structures.md](./05-data-structures.md)
**Covers**: Core data models with JSON Schema validation

**Defines**:
- **Context Node**: Individual context files/documents
- **Context Pack**: Saved selector queries
- **Policy**: Declarative transformation rules
- **Bundle Manifest**: Resolution metadata for audit/reproducibility
- **Export Approval**: Approval workflow records

**Includes**:
- YAML frontmatter format (file-native)
- JSON Schema definitions
- MongoDB document mappings
- Validation rules

---

## Workflow: Specs → Features → Code

```
┌──────────────────────────────────────────────────────────┐
│ 1. Write Specification by Example (Markdown)            │
│    - Concrete scenarios with inputs/outputs              │
│    - Business-readable language                          │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Extract Gherkin Features (Cucumber)                   │
│    - Given/When/Then scenarios                           │
│    - Structured for test automation                      │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Implement Step Definitions (Code)                     │
│    - Map Gherkin steps to test code                      │
│    - Reusable step library                               │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Build Production Code (TDD)                           │
│    - Write minimal code to pass tests                    │
│    - Refactor with confidence                            │
└──────────────────────────────────────────────────────────┘
```

## How to Use These Specs

### For New Features
1. Start with the relevant spec document
2. Read through examples to understand behavior
3. Review the Gherkin feature file for test structure
4. Implement step definitions (if not existing)
5. Write production code to pass tests

### For Bug Fixes
1. Find the relevant example in specs
2. Verify if the example is incomplete or incorrect
3. Update spec if needed (document first!)
4. Update/add Gherkin scenario
5. Fix code to match spec

### For Code Review
1. Check that code matches spec examples
2. Verify all acceptance criteria are met
3. Ensure new behavior has corresponding spec examples

## Testing Against Specs

### Run All Tests
```bash
# File-based vault (standalone CLI)
npm test

# MongoDB-backed vault (PromptOwl integration)
npm test:integration
```

### Run Specific Feature
```bash
npm test -- features/01-selector-resolution.feature
```

### Run Specific Scenario
```bash
npm test -- --name "Select by single tag"
```

## Validation Checklist

Before marking a spec as "implemented", verify:

- [ ] All examples in the spec pass as tests
- [ ] Both file-based and MongoDB modes work (if applicable)
- [ ] Error messages match spec examples
- [ ] Manifest/audit output matches spec
- [ ] Performance meets spec requirements (if specified)
- [ ] Edge cases from spec are handled

## Extending Specs

When adding new capabilities:

1. **Add Examples**: Write 3-5 concrete examples showing the feature
2. **Document Edge Cases**: What happens when inputs are invalid?
3. **Show Error Messages**: Include exact expected error text
4. **Update Feature File**: Add corresponding Gherkin scenarios
5. **Update Acceptance Criteria**: Add checkbox for the new capability

## Spec Maintenance

These specs are **living documents**:

- Update when requirements change
- Add examples when edge cases are discovered
- Refine examples based on user feedback
- Keep in sync with production code

## Questions?

- **Spec unclear?** Add an issue requesting clarification
- **Example missing?** Submit PR with new example
- **Spec contradicts code?** Spec wins (update code), unless spec is wrong (update spec + code)

---

**Next Steps**:
1. Review specs with stakeholders
2. Generate JSON Schemas from data structures spec
3. Implement step definitions for Gherkin features
4. Begin TDD implementation starting with selector parser
