/**
 * Core type definitions generated from JSON Schemas
 * See: schemas/*.schema.json
 */

// Principal types for ABAC permissions
export type PrincipalType = 'user' | 'team' | 'role' | 'agent' | 'system';
export type Principal = `${PrincipalType}:${string}` | '*';

// Node types
export type NodeType =
  | 'document'
  | 'snippet'
  | 'glossary'
  | 'persona'
  | 'policy'
  | 'prompt'
  | 'tool'
  | 'reference';

export type NodeScope =
  | 'user'
  | 'team'
  | 'org'
  | 'public'
  | 'restricted'
  | 'confidential';

export type Audience = 'internal' | 'external' | 'agent' | 'public';
export type Operation = 'resolve' | 'export' | 'store';

/**
 * Context Node - individual unit of context
 * Spec: specs/05-data-structures.md - Data Structure 1
 */
export interface ContextNode {
  id: string; // ulid:...
  title: string;
  type: NodeType;
  owners: Principal[];
  scope?: NodeScope;
  tags?: string[]; // #tag format
  permissions?: {
    read?: Principal[];
    write?: Principal[];
    export?: Principal[];
  };
  version?: number;
  created_at?: string; // ISO 8601
  updated_at?: string; // ISO 8601
  derived_from?: string[]; // ulid references
  checksum?: string; // sha256:...
  metadata?: {
    word_count?: number;
    token_count?: number;
    last_reviewed?: string;
    review_cycle_days?: number;
    [key: string]: any;
  };

  // Content (not in frontmatter)
  content?: string;
}

/**
 * Context Pack - saved selector recipe
 * Spec: specs/05-data-structures.md - Data Structure 2
 */
export interface ContextPack {
  id: string; // pack:...
  label: string;
  description?: string;
  owner?: Principal;
  query: string;
  includes?: string[];
  excludes?: string[];
  filters?: {
    scope?: NodeScope[];
    before?: string; // ISO date
    after?: string; // ISO date
    node_types?: NodeType[];
  };
  post_transforms?: Array<{
    transform: string;
    when?: string; // condition expression
    params?: Record<string, any>;
  }>;
  audiences?: Audience[];
  max_tokens?: number;
  version?: number;
  created_at?: string;
  updated_at?: string;
  usage_count?: number;
  last_used?: string;
}

/**
 * Policy - declarative transformation/governance rule
 * Spec: specs/05-data-structures.md - Data Structure 3
 */
export interface Policy {
  id: string; // policy:...
  label?: string;
  description?: string;
  owner?: Principal;
  priority?: number; // Higher = evaluated first
  when: string[]; // Condition expressions (AND logic)
  then: Array<{
    action: 'transform' | 'deny' | 'require_approval' | 'log' | 'warn' | 'enforce_max_tokens';
    transform?: string;
    params?: Record<string, any>;
    message?: string;
    level?: 'debug' | 'info' | 'warn' | 'error';
    operation?: Operation;
    roles?: Principal[];
    max_tokens?: number;
  }>;
  enabled?: boolean;
  applies_to?: {
    operations?: Operation[];
    node_types?: NodeType[];
    scopes?: NodeScope[];
    tags?: string[];
  };
  version?: number;
  created_at?: string;
  updated_at?: string;
  test_fixtures?: string[];
}

/**
 * Bundle Manifest - resolution metadata
 * Spec: specs/05-data-structures.md - Data Structure 4
 */
export interface BundleManifest {
  bundle_id: string; // ulid:...
  selector: string;
  resolved_at: string; // ISO 8601
  actor: Principal;
  actor_principals?: Principal[];
  audience?: Audience;
  operation: Operation;
  nodes: Array<{
    id: string;
    title: string;
    type?: NodeType;
    checksum: string;
    original_checksum?: string;
    tokens?: number;
    transforms_applied?: string[];
    transform_chain?: Array<{
      transform: string;
      checksum_after: string;
      params?: Record<string, any>;
    }>;
  }>;
  policies_applied?: Array<{
    policy_id: string;
    conditions_matched?: string[];
    actions_taken?: Array<{
      action: string;
      transform?: string;
      target_nodes?: string[];
      result?: 'success' | 'skipped' | 'failed';
      error?: string;
    }>;
  }>;
  nodes_excluded_by_permission?: number;
  nodes_excluded_by_policy?: number;
  total_nodes: number;
  total_tokens: number;
  hash_tree: {
    root: string; // sha256:...
    nodes?: string[];
    algorithm?: string;
  };
  metadata?: {
    vault_id?: string;
    vault_version?: number;
    cli_version?: string;
    engine_version?: string;
    warnings?: string[];
    performance?: {
      resolution_time_ms?: number;
      nodes_evaluated?: number;
      policies_evaluated?: number;
    };
  };
  approval?: {
    required: boolean;
    approval_id?: string;
    approver?: Principal;
    approved_at?: string;
  };
}

/**
 * Export Approval - approval workflow record
 * Spec: specs/05-data-structures.md - Data Structure 5
 */
export interface ExportApproval {
  approval_id: string; // ulid:...
  export_request_id: string;
  approver: Principal;
  approver_principals?: Principal[];
  approved_at: string;
  expires_at?: string;
  conditions?: string[];
  restrictions?: {
    max_shares?: number;
    allowed_recipients?: string[];
    disallow_external?: boolean;
    must_include_watermark?: boolean;
    redact_sensitive?: boolean;
    [key: string]: any;
  };
  notes?: string;
  signature?: string; // sha256:...
  metadata?: {
    requester?: Principal;
    request_reason?: string;
    node_count?: number;
    restricted_node_titles?: string[];
    [key: string]: any;
  };
  revoked?: boolean;
  revoked_at?: string;
  revoked_by?: Principal;
  revocation_reason?: string;
  usage_count?: number;
  last_used_at?: string;
}

/**
 * Syntax Configuration
 * Allows customization of selector tokens (Obsidian vs Owlpad)
 */
export interface SyntaxConfig {
  tokens: {
    title_transclusion: string; // e.g., "[[{{title}}]]" or "(({{title}}))"
    tag: string; // e.g., "#{{tag}}" or "@{{tag}}"
    owner_scope: string; // e.g., "@{{owner}}/{{title}}"
    pack_reference: string; // e.g., "pack:{{pack_id}}"
  };
}

/**
 * Storage Provider Interface
 * Abstraction for file-based vs MongoDB storage
 */
export interface NodeFilter {
  type?: NodeType | NodeType[];
  scope?: NodeScope | NodeScope[];
  tags?: string[];
  owners?: Principal[];
  before?: Date;
  after?: Date;
}

export interface StorageProvider {
  listNodes(filter?: NodeFilter): Promise<ContextNode[]>;
  getNodeById(id: string): Promise<ContextNode | null>;
  getNodeByTitle(title: string, owner?: string): Promise<ContextNode | null>;
  putNode(node: ContextNode): Promise<void>;
  deleteNode(id: string): Promise<void>;
}

/**
 * Resolution Context
 * Parameters for context resolution
 */
export interface ResolutionContext {
  selector: string;
  actor: Principal;
  actor_principals?: Principal[];
  audience?: Audience;
  operation?: Operation;
  max_tokens?: number;
}

/**
 * Resolution Result
 * Output of context resolution with metadata
 */
export interface ResolutionResult {
  bundle: BundleManifest;
  nodes: ContextNode[];
  warnings?: string[];
  errors?: string[];
}

/**
 * Validation Result
 * Output of schema validation
 */
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    value?: any;
  }>;
}

/**
 * Transform Function
 * Pure function that transforms node content
 */
export type TransformFunction = (
  content: string,
  params?: Record<string, any>
) => string | Promise<string>;

/**
 * Policy Evaluation Context
 * Runtime context for policy evaluation
 */
export interface PolicyContext {
  node: ContextNode;
  audience?: Audience;
  operation: Operation;
  scope?: NodeScope;
  actor?: Principal;
  actor_principals?: Principal[];
}

/**
 * Audit Log Entry
 * Record of permission checks and operations
 */
export interface AuditLogEntry {
  timestamp: string;
  event: 'permission_check' | 'policy_applied' | 'bundle_resolved' | 'export_requested' | 'export_approved';
  operation?: Operation;
  actor?: Principal;
  actor_principals?: Principal[];
  resource?: string; // node ID or bundle ID
  resource_title?: string;
  decision?: 'allow' | 'deny';
  matched_principal?: Principal;
  policy_id?: string;
  metadata?: Record<string, any>;
}

/**
 * CLI Output Format
 * Structured output for machine-readable CLI results
 */
export interface CLIOutput {
  success: boolean;
  message?: string;
  data?: any;
  errors?: string[];
  warnings?: string[];
  exit_code: number;
}
