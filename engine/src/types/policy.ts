/**
 * Policy Types
 * Defines policy structures for transform rules and governance
 *
 * Spec: specs/03-policy-transforms.md
 * Tests: src/policy/*.test.ts
 *
 * Policies are declarative rules that transform content or deny operations
 * based on conditions like audience, scope, or node attributes.
 */

import type { ContextNode } from './index.js';
import type { Actor, Principal } from './principal.js';

/**
 * Policy definition
 */
export interface Policy {
  /**
   * Unique policy identifier
   * Format: policy:category.name
   * Example: policy:pii.redact_external
   */
  id: string;

  /**
   * Policy priority (higher = evaluated first)
   * Default: 0
   */
  priority?: number;

  /**
   * Conditions that must all be true for policy to apply
   * All conditions are ANDed together
   */
  when: PolicyCondition[];

  /**
   * Actions to execute when conditions match
   * Executed in order
   */
  then: PolicyAction[];

  /**
   * Optional metadata
   */
  metadata?: {
    description?: string;
    author?: string;
    created_at?: string;
    version?: string;
  };
}

/**
 * Policy condition for matching context
 */
export interface PolicyCondition {
  /**
   * Field to evaluate (supports dot notation)
   * Examples:
   * - "audience"
   * - "scope"
   * - "node.word_count"
   * - "node.tags"
   * - "operation"
   */
  field: string;

  /**
   * Comparison operator
   */
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not in' | 'contains' | 'not contains';

  /**
   * Value to compare against
   */
  value: any;
}

/**
 * Policy action to execute
 */
export interface PolicyAction {
  /**
   * Action type
   */
  type: 'transform' | 'deny' | 'require_approval';

  /**
   * Transform name (when type = transform)
   * Format: "transform_name" or "transform_name:param"
   * Examples:
   * - "redact_pii"
   * - "summarize:1000"
   * - "add_watermark"
   */
  transform?: string;

  /**
   * Operation to deny (when type = deny)
   */
  deny?: 'read' | 'write' | 'export' | 'resolve';

  /**
   * Principals required for approval (when type = require_approval)
   */
  requireApproval?: Principal[];

  /**
   * Additional parameters for the action
   */
  params?: Record<string, any>;
}

/**
 * Context for policy evaluation
 */
export interface PolicyContext {
  /**
   * The context node being evaluated
   */
  node: ContextNode;

  /**
   * Actor performing the operation
   */
  actor?: Actor;

  /**
   * Operation being performed
   */
  operation: 'read' | 'write' | 'export' | 'resolve';

  /**
   * Target audience
   * Examples: "internal", "external", "agent"
   */
  audience?: string;

  /**
   * Maximum token budget
   */
  maxTokens?: number;

  /**
   * Additional context data
   */
  [key: string]: any;
}

/**
 * Result of policy evaluation
 */
export interface PolicyEvaluationResult {
  /**
   * Policies that matched the context
   */
  applicablePolicies: Policy[];

  /**
   * Whether any deny policies matched
   */
  denied: boolean;

  /**
   * Deny reason if denied
   */
  denyReason?: string;

  /**
   * Policy that caused denial
   */
  denyPolicy?: string;
}

/**
 * Transform function signature
 */
export type TransformFunction = (
  content: string,
  params?: Record<string, any>
) => string | Promise<string>;

/**
 * Result of applying a transform
 */
export interface TransformResult {
  /**
   * Transformed content
   */
  content: string;

  /**
   * Checksum of original content
   */
  originalChecksum: string;

  /**
   * Checksum of transformed content
   */
  resultChecksum: string;

  /**
   * When transform was applied
   */
  appliedAt: string;

  /**
   * Transform name and params
   */
  transform: string;

  /**
   * Original word/token count
   */
  originalCount?: {
    words?: number;
    tokens?: number;
  };

  /**
   * Result word/token count
   */
  resultCount?: {
    words?: number;
    tokens?: number;
  };
}

/**
 * Manifest of policies applied to a bundle
 */
export interface PolicyManifest {
  /**
   * Policy IDs that were evaluated and applied
   */
  policiesApplied: string[];

  /**
   * Transforms applied to nodes
   */
  transformsApplied: Array<{
    nodeId: string;
    nodeTitle: string;
    transform: string;
    order: number;
    originalChecksum: string;
    resultChecksum: string;
    originalCount?: { words?: number; tokens?: number };
    resultCount?: { words?: number; tokens?: number };
  }>;

  /**
   * Nodes excluded by policy
   */
  nodesExcluded: Array<{
    nodeId: string;
    nodeTitle: string;
    policy: string;
    reason: string;
  }>;

  /**
   * Approvals required (if any)
   */
  approvalsRequired?: Array<{
    policy: string;
    requiredPrincipals: Principal[];
  }>;

  /**
   * Overall statistics
   */
  stats?: {
    totalNodes: number;
    nodesTransformed: number;
    nodesExcluded: number;
    totalTransforms: number;
  };
}

/**
 * Policy violation error
 */
export class PolicyViolationError extends Error {
  constructor(
    message: string,
    public policyId: string,
    public operation: string,
    public nodeId?: string
  ) {
    super(message);
    this.name = 'PolicyViolationError';
  }
}

/**
 * Helper to create a simple policy condition
 */
export function createCondition(
  field: string,
  operator: PolicyCondition['operator'],
  value: any
): PolicyCondition {
  return { field, operator, value };
}

/**
 * Helper to create a transform action
 */
export function createTransformAction(
  transform: string,
  params?: Record<string, any>
): PolicyAction {
  return { type: 'transform', transform, params };
}

/**
 * Helper to create a deny action
 */
export function createDenyAction(
  operation: 'read' | 'write' | 'export' | 'resolve'
): PolicyAction {
  return { type: 'deny', deny: operation };
}

/**
 * Helper to create an approval action
 */
export function createApprovalAction(
  principals: Principal[]
): PolicyAction {
  return { type: 'require_approval', requireApproval: principals };
}
