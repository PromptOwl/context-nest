Feature: PromptOwl Integration
  As a PromptOwl user
  I want seamless context management integrated into my workflows
  So that I can leverage structured context in prompts and conversations

  Background:
    Given a PromptOwl instance with MongoDB and context engine enabled
    And a user "misha" with session:
      | user.id       | usr_12345     |
      | user.clientId | client_acme   |
      | user.role     | admin         |
    And context nodes stored in MongoDB collection "context_nodes"

  Scenario: Add context pack in prompt editor
    Given I am editing a prompt in PromptOwl
    When I click "Add Context Pack"
    Then a selector dialog should open
    When I type selector "#onboarding + #external"
    Then I should see real-time preview:
      | documents matched | 3          |
      | tokens estimated  | ~2400      |
      | policies          | PII Redaction |
    When I click "Insert Context Pack"
    Then the prompt should contain placeholder "{{context:pack:01J...AB}}"
    And the pack should be saved to conversation metadata

  Scenario: Agent uses MCP tool to resolve context
    Given a LangChain workflow with agent "research_assistant"
    And the agent has access to tool "ctx_resolve"
    When the agent calls:
      """
      {
        "tool": "ctx_resolve",
        "parameters": {
          "selector": "#company-overview + #public",
          "max_tokens": 5000
        }
      }
      """
    Then the tool should return:
      | bundle_id    | ulid:01J...CD  |
      | total_tokens | 1550           |
      | node_count   | 2              |
    And conversation metadata should record context bundle usage

  Scenario: CLI sync to PromptOwl
    Given I have PromptOwl credentials in "~/.promptowl/credentials"
    When I create a new node locally:
      """
      echo "# New Runbook" > vault/new-runbook.md
      ctx store vault/new-runbook.md
      """
    And I run "ctx sync --push"
    Then the CLI should authenticate with PromptOwl API
    And a new ContextNode document should be created in MongoDB:
      | userId          | usr_12345        |
      | title           | New Runbook      |
      | synced_from_cli | true             |
    And I should see output:
      """
      ✓ Synced 1 node to PromptOwl
      View: https://app.promptowl.ai/context
      """

  Scenario: Drift detection on context pack
    Given a context pack "product-docs" created 1 week ago
    And the pack initially resolved to 5 documents, 3200 tokens
    And 2 new documents tagged "#product-docs" were added since
    When I open an old conversation that used the pack
    Then I should see drift badge:
      """
      ⚠️ Context Pack Updated
      Original: 5 docs, 3200 tokens
      Current: 7 docs, 4100 tokens
      """
    When I click "View Changes"
    Then I should see diff showing 2 new documents
    When I click "Update Context"
    Then the pack should re-resolve with current vault state
    And conversation metadata should record update with new ETag

  Scenario: Server Action - Resolve Context
    Given I am in PromptOwl UI
    When resolveContext Server Action is called:
      """
      {
        "selector": "#onboarding + type:document",
        "actor": "user:usr_12345",
        "audience": "internal",
        "maxTokens": 10000
      }
      """
    Then the Server Action should:
      | 1. Call connectDb()                            |
      | 2. Query MongoDB context_nodes collection      |
      | 3. Check permissions against user principals   |
      | 4. Apply org-level policies                    |
      | 5. Return bundle with metadata                 |
    And the UI should display preview and insert into prompt

  Scenario: Context pack in sequential workflow
    Given a sequential prompt with 3 blocks:
      | Block 1 | Research with context pack "#competitive-intel" |
      | Block 2 | Analyze using {{block_1_output}}                |
      | Block 3 | Generate report                                 |
    When the workflow runs
    Then Block 1 should resolve context pack (3 docs, 4000 tokens)
    And Block 2 should receive only Block 1 findings (not context)
    And conversation metadata should track:
      | workflow_context.block_1.context_pack | pack:competitive.intel |
      | workflow_context.block_1.tokens_used  | 4000                   |

  Scenario: Pack management UI
    Given I navigate to "Context Packs" page in PromptOwl
    Then I should see list of saved packs:
      | Onboarding Basics     | 5 docs, ~3.2k tokens, last used: 2 days ago  |
      | Product Docs External | 8 docs, ~6.1k tokens, last used: 1 week ago  |
    And each pack should have actions: [Edit] [Preview] [Delete]
    When I click [Preview] on "Onboarding Basics"
    Then I should see current resolution without executing

  Scenario: Export with approval UI
    Given I have a conversation with restricted context
    And a policy requires approval from "role:compliance"
    When I click "Export Conversation"
    Then I should see approval request dialog:
      """
      Export Requires Approval
      Restricted Nodes:
      • Financial Report Q3 2025
      • Customer Contract Template
      """
    When I click "Request Approval"
    Then a ContextExportRequest should be created in MongoDB
    And users with "role:compliance" should be notified
    When compliance officer approves
    Then ContextExportApproval document should be created
    And export should proceed
    And I should be notified of approval

  Scenario: Context token budget warning
    Given PromptOwl settings have max_context_tokens: 8000
    And I am editing a prompt
    When I add a context pack that resolves to 10,000 tokens
    Then I should see warning:
      """
      ⚠️ Token Budget Exceeded
      Selected: 10,000 tokens
      Budget: 8,000 tokens
      Overflow: 2,000 tokens
      """
    And I should see options:
      | Apply auto-summarization  |
      | Refine selector           |
      | Increase budget           |

  Scenario: Conversation context metadata tracking
    Given a conversation using context packs
    Then the conversation document should contain:
      """
      context_metadata: {
        packs_used: [{
          pack_id: "pack:onboarding.basics",
          selector: "#onboarding + type:document",
          resolved_at: "2025-10-28T21:30:00Z",
          bundle_id: "ulid:01J...ST",
          node_count: 5,
          token_count: 3200,
          etag: "sha256:abc123...",
          policies_applied: ["policy:pii.redact_external"]
        }],
        total_context_tokens: 3200,
        drift_checks: [...]
      }
      """

  Scenario: MCP tool definition and usage
    Given PromptOwl loads MCP tools dynamically
    Then "ctx_resolve" tool should be available with schema:
      """
      {
        "name": "ctx_resolve",
        "description": "Resolve context nodes using selector query",
        "inputSchema": {
          "properties": {
            "selector": { "type": "string" },
            "max_tokens": { "type": "number", "default": 5000 },
            "audience": { "type": "string", "enum": ["internal", "external", "agent"] }
          }
        }
      }
      """
    When an agent calls the tool in a workflow
    Then the handler in lib/metamcp-tools.ts should execute
    And permissions should be checked
    And result should be logged to conversation metadata

  Scenario: CLI to PromptOwl auth flow
    When I run "ctx login"
    Then the CLI should open browser to PromptOwl OAuth
    When I authorize the CLI
    Then PromptOwl should generate API key with scopes:
      | context:read  |
      | context:write |
      | context:sync  |
    And credentials should be stored in "~/.promptowl/credentials"
    And I should see:
      """
      ✓ Authenticated as misha@promptowl.ai
      Commands:
        ctx sync --push
        ctx sync --pull
      """

  Scenario: Sync local changes to PromptOwl
    Given I have local vault with 10 nodes
    And I modify 2 nodes and add 1 new node
    When I run "ctx sync --push"
    Then the CLI should:
      | 1. Calculate checksums for changed nodes |
      | 2. Authenticate with PromptOwl API       |
      | 3. Upload only changed/new nodes (3)     |
      | 4. Update MongoDB documents              |
    And I should see output:
      """
      ✓ Synced 3 nodes
        • modified: node-001, node-005
        • new: node-011
      """

  Scenario: Pull changes from PromptOwl
    Given PromptOwl has 15 nodes in my vault
    And my local vault has 10 nodes
    When I run "ctx sync --pull"
    Then the CLI should:
      | 1. Fetch node list from PromptOwl API       |
      | 2. Compare checksums                        |
      | 3. Download 5 new/changed nodes             |
      | 4. Write to local vault with frontmatter    |
    And I should see output:
      """
      ✓ Pulled 5 nodes from PromptOwl
        • new: node-011, node-012, node-013
        • updated: node-004, node-007
      """

  Scenario: Context pack picker shows policy preview
    Given I am adding a context pack to a prompt
    And the pack will trigger policies:
      | policy:pii.redact_external  |
      | policy:summarize.auto       |
    When the preview loads
    Then I should see:
      """
      📋 Policies that will apply:
      • PII Redaction (external audience)
      • Auto-summarization (if >10k tokens)
      """

  Scenario: Conversation export includes context manifest
    Given a conversation that used context packs
    When I export the conversation
    Then the export should include:
      | conversation.json   | Full conversation data         |
      | context_manifest.yml| Bundle metadata and checksums  |
      | context_nodes/      | Node files used in conversation|
    And the manifest should enable reproduction of exact context

  Scenario: Agent context resolution respects user permissions
    Given a user with principals:
      | user:usr_12345   |
      | team:client_acme |
    And an agent in user's conversation
    When the agent calls ctx_resolve
    Then the resolution should use actor "agent:conversation_id"
    But permissions should inherit from user's principals
    And restricted nodes should be excluded per user permissions

  Scenario: Real-time token estimation in pack preview
    Given I am typing a selector in the pack picker
    When I type "#onboarding"
    Then I should see real-time updates:
      | Matches | Token estimate |
      | 5 docs  | ~3200 tokens   |
    When I add "+ type:document"
    Then the preview should update:
      | Matches | Token estimate |
      | 3 docs  | ~2400 tokens   |

  Scenario: Context pack versioning and rollback
    Given a context pack "pack:onboarding.basics" at version 3
    And a conversation used version 2 of the pack
    When I view the conversation's context metadata
    Then I should see which pack version was used
    And I should have option to "Resolve with original version"
    When I click "Resolve with original version"
    Then the system should use pack definition from version 2

  Scenario: Bulk pack operations
    Given I have selected 5 context packs in the UI
    When I choose "Bulk Update"
    Then I should be able to:
      | Add tag to all packs     |
      | Change audience setting  |
      | Apply new policy         |
      | Archive unused packs     |
    And all changes should be transactional

  Scenario: Context usage analytics
    Given I navigate to "Context Analytics" in PromptOwl
    Then I should see metrics:
      | Most used packs          | Ranked by usage_count         |
      | Token consumption        | By pack, over time            |
      | Policy application rate  | How often each policy applies |
      | Permission denials       | Which nodes are blocked most  |
    And I should be able to filter by date range and user

  Scenario: White-label context branding
    Given a white-label client "Beta Theme"
    And the client has custom branding colors
    When users access Context UI
    Then the context picker should use client brand colors
    And the pack list should show client logo
    And terminology should match client preferences:
      | "Context Pack" → "Knowledge Bundle" |
