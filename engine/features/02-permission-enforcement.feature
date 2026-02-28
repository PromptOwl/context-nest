Feature: Permission Enforcement
  As a context administrator
  I want fine-grained access control on context nodes
  So that sensitive information is only accessible to authorized principals

  Background:
    Given a vault with the following nodes:
      | id       | title              | scope      |
      | node-101 | SEV Runbook        | team       |
      | node-102 | Public FAQ         | public     |
      | node-103 | Internal Guide     | team       |
      | node-104 | Restricted Doc     | restricted |
      | node-105 | Financial Report   | restricted |
      | node-106 | Public Whitepaper  | public     |
      | node-107 | Compliance Check   | org        |
      | node-108 | API Keys           | restricted |
      | node-109 | Company Strategy   | org        |
      | node-110 | Public Roadmap     | public     |
      | node-111 | Draft Doc          | user       |
    And node "node-101" has permissions:
      | read  | team:sre, role:exec_view |
      | write | user:misha               |
    And node "node-102" has permissions:
      | read   | *       |
      | export | *       |
    And node "node-103" has permissions:
      | read | team:engineering |
    And node "node-104" has permissions:
      | read | role:admin |
    And node "node-105" has permissions:
      | read | team:finance, role:exec |
    And node "node-106" has permissions:
      | read   | *       |
      | export | *       |
    And node "node-107" has permissions:
      | read   | role:compliance, role:admin |
      | export | role:compliance             |
    And node "node-108" has permissions:
      | read   | agent:trusted_bot, user:misha |
      | export | user:misha                    |
    And node "node-109" has permissions:
      | read | team:leadership |
    And node "node-110" has permissions:
      | read   | *             |
      | write  | team:product  |
      | export | *             |
    And node "node-111" has no permissions defined

  Scenario: Read permission allowed by team membership
    Given an actor "agent:web1" with principals:
      | team:sre    |
      | agent:web1  |
    When I resolve selector "[[SEV Runbook]]" as actor "agent:web1"
    Then the resolution should succeed
    And the bundle should contain node "node-101"

  Scenario: Read permission denied - no matching principals
    Given an actor "agent:web2" with principals:
      | team:engineering |
      | agent:web2       |
    When I resolve selector "[[SEV Runbook]]" as actor "agent:web2"
    Then the resolution should fail with error "Permission denied"
    And the error should specify actor "agent:web2" cannot read node "node-101"

  Scenario: Multiple nodes with partial access
    Given an actor "user:alice" with principals:
      | user:alice        |
      | team:engineering  |
    And nodes are tagged with "#guide":
      | node-102 |
      | node-103 |
      | node-104 |
    When I resolve selector "#guide" as actor "user:alice"
    Then the resolution should succeed with warning
    And the bundle should contain nodes:
      | node-102 |
      | node-103 |
    And the bundle should not contain node "node-104"
    And the bundle metadata should show "nodes_excluded_by_permission: 1"

  Scenario: Write permission denied
    Given an actor "user:bob" with principals:
      | user:bob         |
      | team:engineering |
    And node "node-110" allows write for "team:product"
    When I attempt to store node "node-110" as actor "user:bob"
    Then the operation should fail with error "Permission denied"
    And no changes should be persisted

  Scenario: Export permission - default deny
    Given an actor "user:cfo" with principals:
      | user:cfo  |
      | role:exec |
    And node "node-105" has no export permissions defined
    When I attempt to export bundle containing node "node-105" as actor "user:cfo"
    Then the export should fail with error "Export denied"
    And the error should state "No export permissions defined for node node-105"

  Scenario: Export permission - explicit allow
    Given an actor "user:guest" with principals:
      | user:guest |
    And node "node-106" allows export for "*"
    When I export bundle containing node "node-106" as actor "user:guest"
    Then the export should succeed

  Scenario: Role-based access for read and export
    Given an actor "user:auditor" with principals:
      | user:auditor    |
      | role:compliance |
    When I resolve selector "[[Compliance Check]]" as actor "user:auditor"
    Then the resolution should succeed
    When I export the resolved bundle as actor "user:auditor"
    Then the export should succeed

  Scenario: Agent-specific permissions - read allowed
    Given an actor "agent:trusted_bot" with principals:
      | agent:trusted_bot |
    When I resolve selector "[[API Keys]]" as actor "agent:trusted_bot"
    Then the resolution should succeed

  Scenario: Agent-specific permissions - export denied
    Given an actor "agent:trusted_bot" with principals:
      | agent:trusted_bot |
    And node "node-108" allows read for "agent:trusted_bot" but not export
    When I attempt to export bundle containing node "node-108" as actor "agent:trusted_bot"
    Then the export should fail with error "Permission denied"

  Scenario: Hierarchical team permissions
    Given an actor "user:director" with principals:
      | user:director    |
      | team:leadership  |
      | team:engineering |
    When I resolve selector "[[Company Strategy]]" as actor "user:director"
    Then the resolution should succeed
    And the permission should match on "team:leadership"

  Scenario: Wildcard permissions
    Given an actor "user:anonymous" with principals:
      | user:anonymous |
    When I resolve selector "[[Public Roadmap]]" as actor "user:anonymous"
    Then the resolution should succeed
    When I attempt to write to node "node-110" as actor "user:anonymous"
    Then the write should fail with error "Permission denied"
    When I export bundle containing node "node-110" as actor "user:anonymous"
    Then the export should succeed

  Scenario: Empty permissions - deny all
    Given an actor "user:admin" with principals:
      | user:admin |
      | role:admin |
    And node "node-111" has no permissions field
    When I resolve selector "[[Draft Doc]]" as actor "user:admin"
    Then the resolution should fail with error "Permission denied"
    And the error should state "No read permissions defined for node node-111"

  Scenario: Permission check during pack resolution
    Given a pack "pack:engineering.all" with query "scope:team"
    And vault contains nodes:
      | node-102 | read: *                |
      | node-103 | read: team:engineering |
      | node-104 | read: role:admin       |
    And an actor "user:eng_member" with principals:
      | user:eng_member  |
      | team:engineering |
    When I resolve selector "pack:engineering.all" as actor "user:eng_member"
    Then the resolution should succeed
    And the bundle should contain nodes:
      | node-102 |
      | node-103 |
    And the bundle should not contain node "node-104"
    And the bundle metadata should show "nodes_excluded_by_permission: 1"

  Scenario: NextAuth session mapping (PromptOwl integration)
    Given a PromptOwl session with:
      | user.id       | usr_12345     |
      | user.clientId | client_acme   |
      | user.role     | admin         |
    And node "node-109" allows read for "team:client_acme, role:admin"
    When I call resolveContext with the session
    Then the session should map to principals:
      | user:usr_12345   |
      | team:client_acme |
      | role:admin       |
    And the permission check should succeed via "team:client_acme"

  Scenario: Clear error message with principal mismatch
    Given an actor "user:bob" with principals:
      | user:bob         |
      | team:engineering |
    And node "node-105" requires principals:
      | team:legal |
      | role:exec  |
    When I attempt to read node "node-105" as actor "user:bob"
    Then the error should include:
      | error               | PERMISSION_DENIED                  |
      | actor               | user:bob                           |
      | required_principals | team:legal, role:exec              |
      | actor_principals    | user:bob, team:engineering         |

  Scenario: Audit trail for permission checks
    Given an actor "agent:web1" with principals:
      | agent:web1 |
      | team:sre   |
    When I resolve selector "[[SEV Runbook]]" as actor "agent:web1"
    Then the resolution should succeed
    And an audit log entry should be created with:
      | event             | permission_check   |
      | operation         | read               |
      | actor             | agent:web1         |
      | resource          | node-101           |
      | decision          | allow              |
      | matched_principal | team:sre           |
