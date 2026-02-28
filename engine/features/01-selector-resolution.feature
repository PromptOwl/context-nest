Feature: Selector Resolution
  As a context user
  I want to query context nodes using flexible selector syntax
  So that I can compose the right context for any task

  Background:
    Given a vault with the following nodes:
      | id          | title                 | type     | tags                      | scope  | owners         |
      | node-001    | Onboarding Overview   | document | #onboarding,#public       | team   | team:hr        |
      | node-002    | Onboarding Internal   | document | #onboarding,#internal     | team   | team:hr        |
      | node-003    | Security Policy       | document | #security,#compliance     | org    | team:security  |
      | node-004    | Brand Guidelines      | document | #brand,#public            | public | team:marketing |
      | node-005    | Brand One-Pager       | document | #brand,#public            | public | team:marketing |
      | node-006    | Current Guide         | document | #guide                    | team   | team:eng       |
      | node-007    | Old Guide             | document | #guide,#deprecated        | team   | team:eng       |
      | node-008    | Legal Template        | document |                           | team   | team:legal     |
      | node-009    | Eng Runbook           | document |                           | team   | team:eng       |
      | node-010    | Product Glossary      | glossary | #product                  | team   | team:product   |
      | node-011    | Product Guide         | document | #product                  | team   | team:product   |
      | node-012    | Q1 Report             | document | #report                   | team   | team:finance   |
      | node-013    | Q2 Report             | document | #report                   | team   | team:finance   |
    And node "node-008" has title "Contract Template"
    And node "node-009" has title "Contract Template"
    And node "node-012" was created on "2025-03-15"
    And node "node-013" was created on "2025-06-20"

  Scenario: Select by single tag
    When I resolve selector "#onboarding"
    Then the bundle should contain nodes:
      | node-001 |
      | node-002 |
    And the bundle should not contain node "node-003"

  Scenario: Select by title transclusion
    When I resolve selector "[[Brand One-Pager]]"
    Then the bundle should contain exactly:
      | node-005 |

  Scenario: Composition with AND operator
    When I resolve selector "#onboarding + #external"
    Then the bundle should contain exactly:
      | node-001 |
    And the bundle should not contain node "node-002"

  Scenario: Exclusion with NOT operator
    When I resolve selector "#guide - #deprecated"
    Then the bundle should contain exactly:
      | node-006 |
    And the bundle should not contain node "node-007"

  Scenario: Owner scoping with unique title
    Given node "node-008" has owner "team:legal" and title "Contract Template"
    And node "node-009" has owner "team:engineering" and title "Contract Template"
    When I resolve selector "@legal/Contract Template"
    Then the bundle should contain exactly:
      | node-008 |

  Scenario: Type filtering
    When I resolve selector "#product type:glossary"
    Then the bundle should contain exactly:
      | node-010 |
    And the bundle should not contain node "node-011"

  Scenario: Date range filtering - before
    When I resolve selector "type:document before:2025-06-01"
    Then the bundle should contain node "node-012"
    And the bundle should not contain node "node-013"

  Scenario: Scope filtering
    When I resolve selector "scope:public"
    Then the bundle should contain nodes:
      | node-004 |
      | node-005 |
    And the bundle should not contain node "node-001"

  Scenario: Saved pack reference
    Given a pack "pack:onboarding.basics" with query "#onboarding + type:document"
    When I resolve selector "pack:onboarding.basics"
    Then the bundle should contain nodes:
      | node-001 |
      | node-002 |
    And the bundle should not contain node "node-010"

  Scenario: Complex composition with pack
    Given a pack "pack:onboarding.basics" with query "#onboarding + type:document"
    When I resolve selector "pack:onboarding.basics + [[Brand One-Pager]] - #deprecated"
    Then the bundle should contain nodes:
      | node-001 |
      | node-002 |
      | node-005 |

  Scenario: Invalid pack reference
    When I resolve selector "pack:nonexistent.pack"
    Then I should receive an error "Pack not found: pack:nonexistent.pack"

  Scenario: Ambiguous title without owner scope
    Given multiple nodes with title "Contract Template"
    When I resolve selector "[[Contract Template]]"
    Then I should receive an error matching "Ambiguous title reference.*matches 2 nodes"
    And the error should suggest using "@owner/title to disambiguate"

  Scenario: Empty result set
    When I resolve selector "#nonexistent-tag"
    Then the bundle should be empty
    And the bundle metadata should show "total_nodes: 0"

  Scenario: Multiple tags with OR logic
    When I resolve selector "#onboarding | #brand"
    Then the bundle should contain nodes:
      | node-001 |
      | node-002 |
      | node-004 |
      | node-005 |

  Scenario: Parentheses for precedence
    When I resolve selector "(#onboarding | #brand) + #public"
    Then the bundle should contain nodes:
      | node-001 |
      | node-004 |
      | node-005 |
    And the bundle should not contain node "node-002"

  Scenario: Custom syntax for Owlpad
    Given a syntax configuration with:
      | title_transclusion | (({{title}}))          |
      | tag                | @{{tag}}               |
      | owner_scope        | ~{{owner}}/{{title}}   |
    When I resolve selector "@onboarding + ((Brand Guide))"
    Then the resolution should use custom syntax tokens
    And the bundle should contain the node with title "Brand Guidelines"
