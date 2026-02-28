/**
 * Permission Checker
 * ABAC (Attribute-Based Access Control) implementation
 *
 * Spec: specs/02-permission-checks.md
 * Tests: src/permissions/checker.test.ts
 *
 * Implements permission checking based on principal matching.
 * Principles:
 * 1. Default Deny: If no explicit permission, access is denied
 * 2. Principal Matching: Allow if actor has ANY matching principal
 * 3. Operation-Specific: Different operations have separate checks
 * 4. Wildcard Support: "*" matches any actor
 */

import type {
  Actor,
  Principal,
  PermissionOperation,
  PermissionCheckResult
} from '../types/principal.js';
import type { ContextNode } from '../types/index.js';

export class PermissionError extends Error {
  constructor(
    message: string,
    public actor: string,
    public operation: PermissionOperation,
    public nodeId: string,
    public nodeTitle?: string
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

export class PermissionChecker {
  /**
   * Check if actor can perform operation on node
   *
   * Algorithm:
   * 1. Get required principals for operation from node
   * 2. If no permissions defined, deny (default deny)
   * 3. If wildcard (*) in required principals, allow
   * 4. Check if any actor principal matches required principals
   * 5. If match found, allow. Otherwise, deny.
   */
  check(
    actor: Actor,
    operation: PermissionOperation,
    node: ContextNode
  ): PermissionCheckResult {
    // 1. Get required principals for this operation
    const requiredPrincipals = this.getRequiredPrincipals(node, operation);

    // 2. No permissions defined = default deny
    if (requiredPrincipals.length === 0) {
      return {
        allowed: false,
        reason: `No ${operation} permissions defined for node`,
        actorPrincipals: actor.principals,
        requiredPrincipals: []
      };
    }

    // 3. Wildcard check - allows any actor
    if (requiredPrincipals.includes('*')) {
      return {
        allowed: true,
        reason: `Wildcard permission allows all actors`,
        matchedPrincipal: '*'
      };
    }

    // 4. Principal intersection - find matching principal
    for (const actorPrincipal of actor.principals) {
      if (requiredPrincipals.includes(actorPrincipal)) {
        return {
          allowed: true,
          reason: `Principal ${actorPrincipal} matches required permissions`,
          matchedPrincipal: actorPrincipal
        };
      }
    }

    // 5. No match found = deny
    return {
      allowed: false,
      reason: `No matching principals for ${operation} operation`,
      requiredPrincipals,
      actorPrincipals: actor.principals
    };
  }

  /**
   * Check permission and throw error if denied
   * Convenience method for operations that should fail fast
   */
  checkOrThrow(
    actor: Actor,
    operation: PermissionOperation,
    node: ContextNode
  ): void {
    const result = this.check(actor, operation, node);

    if (!result.allowed) {
      throw new PermissionError(
        `Permission denied: ${actor.id} cannot ${operation} node ${node.id}${node.title ? ` (${node.title})` : ''}`,
        actor.id,
        operation,
        node.id,
        node.title
      );
    }
  }

  /**
   * Filter nodes by read permission
   * Returns only nodes the actor can read
   *
   * This is more efficient than checking each node individually
   * and throwing errors, as it silently filters.
   */
  filterByPermission(
    actor: Actor,
    nodes: ContextNode[]
  ): ContextNode[] {
    return nodes.filter(node => {
      const result = this.check(actor, 'read', node);
      return result.allowed;
    });
  }

  /**
   * Check multiple operations at once
   * Returns map of operation -> result
   */
  checkMultiple(
    actor: Actor,
    operations: PermissionOperation[],
    node: ContextNode
  ): Record<PermissionOperation, PermissionCheckResult> {
    const results: Record<string, PermissionCheckResult> = {};

    for (const operation of operations) {
      results[operation] = this.check(actor, operation, node);
    }

    return results as Record<PermissionOperation, PermissionCheckResult>;
  }

  /**
   * Get statistics about permission filtering
   * Useful for auditing and debugging
   */
  getFilterStatistics(
    actor: Actor,
    nodes: ContextNode[]
  ): {
    total: number;
    allowed: number;
    denied: number;
    deniedReasons: Record<string, number>;
  } {
    const stats = {
      total: nodes.length,
      allowed: 0,
      denied: 0,
      deniedReasons: {} as Record<string, number>
    };

    for (const node of nodes) {
      const result = this.check(actor, 'read', node);

      if (result.allowed) {
        stats.allowed++;
      } else {
        stats.denied++;

        const reason = result.reason || 'Unknown';
        stats.deniedReasons[reason] = (stats.deniedReasons[reason] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Extract required principals for an operation from node permissions
   */
  private getRequiredPrincipals(
    node: ContextNode,
    operation: PermissionOperation
  ): Principal[] {
    // No permissions object = no permissions defined
    if (!node.permissions) {
      return [];
    }

    const principals = node.permissions[operation];

    // No principals for this operation = not allowed
    if (!principals) {
      return [];
    }

    // Convert string[] to Principal[]
    // TypeScript needs this cast because the schema allows string[] but we treat as Principal[]
    return principals as Principal[];
  }
}
