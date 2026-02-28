/**
 * Principal and Actor Types
 * Defines identity and authorization primitives
 *
 * Spec: specs/02-permission-checks.md
 * Tests: src/permissions/checker.test.ts
 *
 * Principals are identity attributes used for permission matching.
 * Actors are entities (users, agents, etc.) with a set of principals.
 */

/**
 * Principal types for permission checking
 * Format: type:identifier
 * Examples:
 * - user:alice
 * - team:engineering
 * - role:admin
 * - agent:web1
 * - * (wildcard - matches anything)
 */
export type Principal =
  | `user:${string}`    // Individual user
  | `team:${string}`    // Team membership
  | `role:${string}`    // Role assignment
  | `agent:${string}`   // AI agent or service account
  | '*';                // Wildcard (matches any principal)

/**
 * Actor represents an entity performing operations
 * Can be a user, agent, or service
 */
export interface Actor {
  /**
   * Primary identifier (typically matches one of the principals)
   * Examples: user:alice, agent:web1
   */
  id: string;

  /**
   * All principals this actor has
   * Used for permission matching
   */
  principals: Principal[];

  /**
   * Optional metadata about the actor
   * Can include session info, IP address, etc.
   */
  metadata?: Record<string, any>;
}

/**
 * Result of a permission check
 */
export interface PermissionCheckResult {
  /**
   * Whether permission is granted
   */
  allowed: boolean;

  /**
   * Human-readable reason for the decision
   */
  reason: string;

  /**
   * If allowed, which principal matched
   */
  matchedPrincipal?: Principal;

  /**
   * If denied, what principals were required
   */
  requiredPrincipals?: Principal[];

  /**
   * If denied, what principals the actor had
   */
  actorPrincipals?: Principal[];
}

/**
 * Operation types for permission checks
 */
export type PermissionOperation = 'read' | 'write' | 'export';

/**
 * Audit log entry for permission check
 */
export interface PermissionAuditEntry {
  /**
   * ISO 8601 timestamp
   */
  timestamp: string;

  /**
   * Event type (always 'permission_check' for permission audits)
   */
  event: 'permission_check';

  /**
   * Operation being performed
   */
  operation: PermissionOperation;

  /**
   * Actor ID (e.g., user:alice)
   */
  actor: string;

  /**
   * Actor's principals at time of check
   */
  actorPrincipals: Principal[];

  /**
   * Resource ID (node ULID)
   */
  resource: string;

  /**
   * Resource title (for human readability)
   */
  resourceTitle: string;

  /**
   * Decision: allow or deny
   */
  decision: 'allow' | 'deny';

  /**
   * If allowed, which principal matched
   */
  matchedPrincipal?: Principal;

  /**
   * If denied, reason for denial
   */
  reason?: string;
}

/**
 * Helper function to create an Actor
 */
export function createActor(
  id: string,
  principals: Principal[],
  metadata?: Record<string, any>
): Actor {
  return { id, principals, metadata };
}

/**
 * Helper function to check if a string is a valid Principal
 */
export function isPrincipal(value: string): value is Principal {
  if (value === '*') return true;

  const parts = value.split(':');
  if (parts.length !== 2) return false;

  const [type, identifier] = parts;
  if (!identifier || identifier.length === 0) return false;

  return ['user', 'team', 'role', 'agent'].includes(type);
}

/**
 * Parse a principal string into its type and identifier
 */
export function parsePrincipal(principal: Principal): {
  type: 'user' | 'team' | 'role' | 'agent' | 'wildcard';
  identifier: string;
} | null {
  if (principal === '*') {
    return { type: 'wildcard', identifier: '*' };
  }

  const parts = principal.split(':');
  if (parts.length !== 2) return null;

  const [type, identifier] = parts;

  if (!['user', 'team', 'role', 'agent'].includes(type)) {
    return null;
  }

  return {
    type: type as 'user' | 'team' | 'role' | 'agent',
    identifier
  };
}
