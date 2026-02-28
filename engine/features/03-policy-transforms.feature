Feature: Policy Transforms
  As a governance administrator
  I want declarative policies that automatically transform content
  So that context is safe for different audiences without manual intervention

  Background:
    Given a policy "policy:pii.redact_external" with:
      | when | audience == "external"        |
      | then | transform: redact_pii         |
    And a policy "policy:restricted.deny_export" with:
      | when | scope == "restricted"         |
      | then | deny: export                  |
    And a policy "policy:summarize.large_docs" with:
      | when | node.word_count > 5000 AND audience == "agent" |
      | then | transform: summarize:1200                       |
    And a policy "policy:legal.watermark" with:
      | when | "#legal" in node.tags AND audience == "external" |
      | then | transform: add_watermark, text: "CONFIDENTIAL"    |

  Scenario: PII redaction for external audience
    Given a node "customer-report.md" with content:
      """
      Customer: John Doe (john.doe@example.com, SSN: 123-45-6789)
      Revenue: $50,000
      """
    When I resolve selector "[[Customer Report]]" with audience "external"
    Then the bundle content should be:
      """
      Customer: [REDACTED_NAME] ([REDACTED_EMAIL], SSN: [REDACTED_SSN])
      Revenue: $50,000
      """
    And the manifest should list policy "policy:pii.redact_external" as applied

  Scenario: No transform for internal audience
    Given a node "customer-report.md" with content:
      """
      Customer: John Doe (john.doe@example.com, SSN: 123-45-6789)
      Revenue: $50,000
      """
    When I resolve selector "[[Customer Report]]" with audience "internal"
    Then the bundle content should be unchanged
    And the manifest should show no policies applied

  Scenario: Deny export for restricted scope
    Given a node "trade-secret.md" with scope "restricted"
    When I attempt to export bundle containing "trade-secret.md"
    Then the export should fail with error "Policy violation"
    And the error should reference policy "policy:restricted.deny_export"
    And no bundle should be created

  Scenario: Summarization for large documents
    Given a node "architecture-guide.md" with 8000 words
    When I resolve selector "[[Architecture Guide]]" with audience "agent"
    Then the bundle content should be summarized
    And the summarized content should have approximately 1200 words
    And the manifest should record:
      | policy              | policy:summarize.large_docs |
      | transform           | summarize:1200              |
      | original_words      | 8000                        |
      | result_words        | ~1200                       |

  Scenario: Multiple policies on same node
    Given a node "case-study.md" with:
      | word_count | 4000                                    |
      | content    | Contains PII: alice@example.com         |
    And policies:
      | policy:pii.redact           | when: audience == "external", then: redact_pii       |
      | policy:summarize.external   | when: audience == "external" AND word_count > 3000   |
    When I resolve selector "[[Case Study]]" with audience "external"
    Then the content should be PII-redacted first
    And then summarized to approximately 1000 words
    And the manifest should list both policies in order:
      | policy:pii.redact         |
      | policy:summarize.external |

  Scenario: Watermark for legal documents
    Given a node "contract-template.md" with tags "#legal, #template"
    When I resolve selector "[[Contract Template]]" with audience "external"
    Then the bundle content should have watermark prepended:
      """
      ---
      CONFIDENTIAL - DO NOT DISTRIBUTE
      ---
      """

  Scenario: Deny export without approval
    Given a policy "policy:export.require_approval" with:
      | when | operation == "export" AND scope in ["restricted", "confidential"] |
      | then | require_approval: role:compliance                                 |
    And a node "financial-data.md" with scope "confidential"
    When I attempt to export bundle as actor "user:analyst"
    Then the export should be blocked
    And a pending export request should be created
    And the error should state "Requires approval from role:compliance"

  Scenario: Export with approval
    Given a pending export request "export-req-001" for "financial-data.md"
    And an approval by "user:compliance_officer" with principal "role:compliance"
    When I export bundle "export-req-001" as actor "user:analyst"
    Then the export should succeed
    And the manifest should include approval metadata

  Scenario: Token budget enforcement
    Given a policy "policy:token.limit" with:
      | when | audience == "agent"            |
      | then | enforce_max_tokens: 50000      |
    And a selector that resolves to 80000 tokens
    When I resolve the selector with audience "agent" and max_tokens 50000
    Then the content should be auto-summarized
    And the final token count should be <= 50000
    And the manifest should record:
      | original_token_count | 80000 |
      | final_token_count    | ~50000|
      | summarization_applied| true  |

  Scenario: Conditional deny based on scope
    Given a policy "policy:scope.public_only_external" with:
      | when | audience == "external" AND scope != "public" |
      | then | deny: resolve                                |
    And nodes:
      | public-faq.md      | scope: public |
      | internal-guide.md  | scope: team   |
    And both tagged "#guide"
    When I resolve selector "#guide" with audience "external"
    Then the bundle should contain only "public-faq.md"
    And the bundle should not contain "internal-guide.md"
    And the manifest should warn "Policy denied 1 node"

  Scenario: Date-based expiration warning
    Given a policy "policy:expiration.old_docs" with:
      | when | node.age_days > 365 AND "#evergreen" not in node.tags |
      | then | transform: add_warning, message: "Document may be outdated" |
    And a node "2024-roadmap.md" created 500 days ago without "#evergreen" tag
    When I resolve selector "[[2024 Roadmap]]"
    Then the bundle content should have warning prepended:
      """
      ⚠️ This document is over 1 year old. Content may be outdated.
      """

  Scenario: Chain of transforms
    Given a policy "policy:external.sanitize" with chained transforms:
      | transform: redact_pii            |
      | transform: remove_internal_links |
      | transform: summarize:2000        |
      | transform: add_disclaimer        |
    And a node "customer-case-study.md" with 5000 words, PII, and internal [[links]]
    When I resolve selector "[[Customer Case Study]]" with audience "external"
    Then the transforms should apply in order:
      | 1. PII redacted                  |
      | 2. Internal links removed        |
      | 3. Content summarized to ~2000w  |
      | 4. Disclaimer added              |
    And the manifest should record transform chain with checksums

  Scenario: Policy dry run
    Given a new policy "policy:test.aggressive_redaction" with:
      | when | audience == "external"         |
      | then | transform: redact_all_numbers  |
    When I run policy test against fixtures:
      | financial-report.md |
      | timeline.md         |
      | version-history.md  |
    Then the dry run report should show:
      | passed | 12 fixtures                               |
      | failed | 3 fixtures: financial-report, timeline... |
    And the report should detail failures:
      | financial-report.md | Removed critical metric (revenue)  |
      | timeline.md         | Dates removed, unreadable          |
    And recommendations should be provided

  Scenario: Org-level policy enforcement (PromptOwl)
    Given PromptOwl client "Acme Corp" with policy "policy:acme.compliance":
      | when | operation == "export" AND audience == "external" |
      | then | require_approval: role:compliance_officer        |
      | then | transform: add_watermark, text: "© Acme Corp"    |
    When a user in Acme Corp exports bundle via UI
    Then export should require compliance approval
    And all exported content should include "© Acme Corp" watermark
    And audit log should record org policy application

  Scenario: Runtime policy loading (PromptOwl)
    Given PromptOwl policies in:
      | /policies/global/        | Priority: 1 |
      | /policies/client_acme/   | Priority: 2 |
      | /policies/user_12345/    | Priority: 3 |
    And conflicting policies exist at multiple levels
    When resolveContext Server Action is called
    Then policies should apply in precedence:
      | 1. User policies (highest)   |
      | 2. Org policies              |
      | 3. Global policies (lowest)  |
    And most specific policy should win conflicts

  Scenario: Transform with parameters
    Given a policy with parameterized transform:
      | transform | add_watermark                           |
      | params    | text: "DRAFT", position: "top-center"   |
    When the policy applies to a node
    Then the transform should receive parameters
    And the watermark should be positioned correctly

  Scenario: Policy applies to specific node types
    Given a policy "policy:docs.footer" with:
      | applies_to | node_types: ["document"], scopes: ["team"] |
      | when       | true                                       |
      | then       | transform: add_disclaimer                  |
    And nodes:
      | doc.md     | type: document, scope: team     |
      | snippet.md | type: snippet, scope: team      |
    When I resolve both nodes
    Then policy should apply only to "doc.md"
    And "snippet.md" should be untransformed

  Scenario: Policy disabled flag
    Given a policy "policy:old.rule" with enabled: false
    When I resolve nodes matching the policy conditions
    Then the policy should not apply
    And the manifest should not list the policy

  Scenario: Transform checksum chain
    Given a node with content "Original text"
    And multiple transforms applied:
      | redact_pii   | Checksum after: sha256:abc... |
      | summarize    | Checksum after: sha256:def... |
      | add_watermark| Checksum after: sha256:ghi... |
    When I inspect the manifest
    Then the manifest should record checksum after each transform
    And the chain should be auditable for debugging

  Scenario: Custom transform (PromptOwl Pro)
    Given a user-defined custom transform "anonymize_company_names"
    And the transform is registered in the transform registry
    When a policy references the custom transform
    Then the transform should execute correctly
    And the result should be included in the bundle
