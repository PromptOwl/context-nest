/**
 * Policy Evaluator
 * Evaluates policy conditions against context to determine applicability
 *
 * Spec: specs/03-policy-transforms.md
 * Tests: src/policy/evaluator.test.ts
 *
 * Evaluates when conditions match context using various operators.
 */

import type {
  Policy,
  PolicyCondition,
  PolicyContext,
  PolicyEvaluationResult
} from '../types/policy.js';
import type { ContextNode } from '../types/index.js';

export class PolicyEvaluator {
  /**
   * Evaluate all policies against context
   * Returns policies that match and any deny decisions
   */
  evaluate(policies: Policy[], context: PolicyContext): PolicyEvaluationResult {
    // Sort by priority (highest first)
    const sortedPolicies = [...policies].sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA;
    });

    const applicablePolicies: Policy[] = [];
    let denied = false;
    let denyReason: string | undefined;
    let denyPolicy: string | undefined;

    for (const policy of sortedPolicies) {
      if (this.matchesConditions(policy.when, context)) {
        applicablePolicies.push(policy);

        // Check for deny actions (fail fast)
        for (const action of policy.then) {
          if (action.type === 'deny' && action.deny === context.operation) {
            denied = true;
            denyReason = `Policy ${policy.id} denies ${action.deny} operation`;
            denyPolicy = policy.id;
            break;
          }
        }

        if (denied) break; // Stop evaluating if denied
      }
    }

    return {
      applicablePolicies,
      denied,
      denyReason,
      denyPolicy
    };
  }

  /**
   * Check if all conditions match the context
   * All conditions must be true (AND logic)
   */
  matchesConditions(conditions: PolicyCondition[], context: PolicyContext): boolean {
    return conditions.every(condition => this.matchesCondition(condition, context));
  }

  /**
   * Check if a single condition matches the context
   */
  private matchesCondition(condition: PolicyCondition, context: PolicyContext): boolean {
    const actualValue = this.getFieldValue(condition.field, context);

    switch (condition.operator) {
      case '==':
        return actualValue === condition.value;

      case '!=':
        return actualValue !== condition.value;

      case '>':
        return typeof actualValue === 'number' && actualValue > condition.value;

      case '<':
        return typeof actualValue === 'number' && actualValue < condition.value;

      case '>=':
        return typeof actualValue === 'number' && actualValue >= condition.value;

      case '<=':
        return typeof actualValue === 'number' && actualValue <= condition.value;

      case 'in':
        if (Array.isArray(condition.value)) {
          return condition.value.includes(actualValue);
        }
        return false;

      case 'not in':
        if (Array.isArray(condition.value)) {
          return !condition.value.includes(actualValue);
        }
        return true;

      case 'contains':
        if (Array.isArray(actualValue)) {
          return actualValue.includes(condition.value);
        }
        if (typeof actualValue === 'string') {
          return actualValue.includes(condition.value);
        }
        return false;

      case 'not contains':
        if (Array.isArray(actualValue)) {
          return !actualValue.includes(condition.value);
        }
        if (typeof actualValue === 'string') {
          return !actualValue.includes(condition.value);
        }
        return true;

      default:
        return false;
    }
  }

  /**
   * Get field value from context using dot notation
   * Examples:
   * - "audience" → context.audience
   * - "node.word_count" → context.node.metadata?.word_count
   * - "node.tags" → context.node.tags
   */
  private getFieldValue(field: string, context: PolicyContext): any {
    const parts = field.split('.');

    let value: any = context;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }

      // Special handling for node.metadata fields
      if (part === 'word_count' || part === 'token_count' || part === 'age_days') {
        value = value.metadata?.[part];
      } else {
        value = value[part];
      }
    }

    return value;
  }

  /**
   * Calculate node age in days
   * Helper for age-based policies
   */
  calculateNodeAge(node: { created_at?: string }): number | undefined {
    if (!node.created_at) return undefined;

    const createdDate = new Date(node.created_at);
    const now = new Date();
    const diffMs = now.getTime() - createdDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Enrich context with computed fields
   * Adds fields like age_days to context.node.metadata
   */
  enrichContext(context: PolicyContext): PolicyContext {
    const enriched = { ...context };

    // Add age_days to node metadata
    if (enriched.node && enriched.node.created_at) {
      const age = this.calculateNodeAge(enriched.node);
      if (age !== undefined) {
        enriched.node = {
          ...enriched.node,
          metadata: {
            ...enriched.node.metadata,
            age_days: age
          }
        };
      }
    }

    return enriched;
  }
}
