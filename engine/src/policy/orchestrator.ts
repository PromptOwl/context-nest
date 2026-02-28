/**
 * Policy Orchestrator
 * Coordinates policy evaluation and transform application
 *
 * Spec: specs/03-policy-transforms.md
 * Tests: src/policy/orchestrator.test.ts
 *
 * Main entry point for policy processing pipeline.
 */

import { PolicyEvaluator } from './evaluator.js';
import { TransformEngine, TransformRegistry } from './transforms.js';
import type {
  Policy,
  PolicyContext,
  PolicyManifest,
  PolicyViolationError as PolicyViolationErrorType
} from '../types/policy.js';
import { PolicyViolationError } from '../types/policy.js';
import type { ContextNode } from '../types/index.js';
import type { AuditLogger } from '../permissions/audit.js';

/**
 * Result of policy processing
 */
export interface PolicyProcessResult {
  /**
   * Processed nodes (transformed or filtered)
   */
  nodes: ContextNode[];

  /**
   * Manifest of all policies and transforms applied
   */
  manifest: PolicyManifest;
}

export class PolicyOrchestrator {
  private evaluator: PolicyEvaluator;
  private transformEngine: TransformEngine;

  constructor(
    private policies: Policy[],
    transformRegistry?: TransformRegistry,
    private auditLogger?: AuditLogger
  ) {
    this.evaluator = new PolicyEvaluator();
    const registry = transformRegistry || new TransformRegistry();
    this.transformEngine = new TransformEngine(registry);
  }

  /**
   * Process nodes through policy pipeline
   * Main entry point for policy processing
   */
  async process(
    nodes: ContextNode[],
    context: Omit<PolicyContext, 'node'>
  ): Promise<PolicyProcessResult> {
    const manifest: PolicyManifest = {
      policiesApplied: [],
      transformsApplied: [],
      nodesExcluded: [],
      stats: {
        totalNodes: nodes.length,
        nodesTransformed: 0,
        nodesExcluded: 0,
        totalTransforms: 0
      }
    };

    const processedNodes: ContextNode[] = [];

    for (const node of nodes) {
      try {
        // Create full context for this node and enrich it
        const baseContext: PolicyContext = {
          ...(context as any),
          node
        };
        const enrichedContext = this.evaluator.enrichContext(baseContext);
        const nodeContext: PolicyContext = {
          ...baseContext,
          node: enrichedContext.node
        };

        // Evaluate policies for this node
        const evaluation = this.evaluator.evaluate(this.policies, nodeContext);

        // Check for deny policies first (fail fast)
        if (evaluation.denied) {
          manifest.nodesExcluded.push({
            nodeId: node.id,
            nodeTitle: node.title || 'Untitled',
            policy: evaluation.denyPolicy || 'unknown',
            reason: evaluation.denyReason || 'Policy denied operation'
          });
          manifest.stats!.nodesExcluded++;
          continue; // Skip this node
        }

        // Check for approval requirements
        const approvalsNeeded = this.checkApprovalRequirements(evaluation.applicablePolicies);
        if (approvalsNeeded.length > 0) {
          // For now, we'll exclude nodes requiring approval
          // In production, this would trigger approval workflow
          manifest.nodesExcluded.push({
            nodeId: node.id,
            nodeTitle: node.title || 'Untitled',
            policy: approvalsNeeded[0].policy,
            reason: 'Approval required'
          });
          manifest.stats!.nodesExcluded++;

          if (!manifest.approvalsRequired) {
            manifest.approvalsRequired = [];
          }
          manifest.approvalsRequired.push(...approvalsNeeded);

          continue;
        }

        // Apply transforms
        let transformedNode = node;
        let transformCount = 0;

        for (const policy of evaluation.applicablePolicies) {
          // Track policy application
          if (!manifest.policiesApplied.includes(policy.id)) {
            manifest.policiesApplied.push(policy.id);
          }

          // Apply transforms from this policy
          for (const action of policy.then) {
            if (action.type === 'transform' && action.transform) {
              const result = await this.transformEngine.apply(
                action.transform,
                transformedNode.content || '',
                action.params
              );

              transformedNode = {
                ...transformedNode,
                content: result.content
              };

              manifest.transformsApplied.push({
                nodeId: node.id,
                nodeTitle: node.title || 'Untitled',
                transform: action.transform,
                order: transformCount + 1,
                originalChecksum: result.originalChecksum,
                resultChecksum: result.resultChecksum,
                originalCount: result.originalCount,
                resultCount: result.resultCount
              });

              transformCount++;
              manifest.stats!.totalTransforms++;
            }
          }
        }

        if (transformCount > 0) {
          manifest.stats!.nodesTransformed++;
        }

        processedNodes.push(transformedNode);
      } catch (error) {
        // Log error but continue processing other nodes
        console.error(`Error processing node ${node.id}:`, error);

        manifest.nodesExcluded.push({
          nodeId: node.id,
          nodeTitle: node.title || 'Untitled',
          policy: 'error',
          reason: `Processing error: ${(error as Error).message}`
        });
        manifest.stats!.nodesExcluded++;
      }
    }

    return {
      nodes: processedNodes,
      manifest
    };
  }

  /**
   * Check if any policies require approval
   */
  private checkApprovalRequirements(policies: Policy[]): Array<{
    policy: string;
    requiredPrincipals: import('../types/principal.js').Principal[];
  }> {
    const approvals: Array<{ policy: string; requiredPrincipals: import('../types/principal.js').Principal[] }> = [];

    for (const policy of policies) {
      for (const action of policy.then) {
        if (action.type === 'require_approval' && action.requireApproval) {
          approvals.push({
            policy: policy.id,
            requiredPrincipals: action.requireApproval
          });
        }
      }
    }

    return approvals;
  }

  /**
   * Dry run: Preview what policies would do without applying them
   */
  async dryRun(
    nodes: ContextNode[],
    context: Omit<PolicyContext, 'node'>
  ): Promise<{
    wouldApply: string[];
    wouldTransform: number;
    wouldExclude: number;
    wouldRequireApproval: number;
  }> {
    let wouldApplySet = new Set<string>();
    let wouldTransform = 0;
    let wouldExclude = 0;
    let wouldRequireApproval = 0;

    for (const node of nodes) {
      const baseContext: PolicyContext = {
        ...(context as any),
        node
      };
      const enrichedContext = this.evaluator.enrichContext(baseContext);
      const nodeContext: PolicyContext = {
        ...baseContext,
        node: enrichedContext.node
      };

      const evaluation = this.evaluator.evaluate(this.policies, nodeContext);

      if (evaluation.denied) {
        wouldExclude++;
        continue;
      }

      const approvalsNeeded = this.checkApprovalRequirements(evaluation.applicablePolicies);
      if (approvalsNeeded.length > 0) {
        wouldRequireApproval++;
        continue;
      }

      let hasTransforms = false;
      for (const policy of evaluation.applicablePolicies) {
        wouldApplySet.add(policy.id);

        for (const action of policy.then) {
          if (action.type === 'transform') {
            hasTransforms = true;
            break;
          }
        }
      }

      if (hasTransforms) {
        wouldTransform++;
      }
    }

    return {
      wouldApply: Array.from(wouldApplySet),
      wouldTransform,
      wouldExclude,
      wouldRequireApproval
    };
  }

  /**
   * Get policies that would apply to a specific node
   */
  getPoliciesForNode(node: ContextNode, context: Omit<PolicyContext, 'node'>): Policy[] {
    const baseContext: PolicyContext = {
      ...(context as any),
      node
    };
    const enrichedContext = this.evaluator.enrichContext(baseContext);
    const nodeContext: PolicyContext = {
      ...baseContext,
      node: enrichedContext.node
    };

    const evaluation = this.evaluator.evaluate(this.policies, nodeContext);
    return evaluation.applicablePolicies;
  }
}
