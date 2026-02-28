/**
 * Selector Resolver
 * Evaluates parsed AST against storage to resolve matching nodes
 *
 * Spec: specs/01-selector-grammar.md
 * Tests: src/selector/resolver.test.ts
 *
 * Pipeline: selector string → tokenize → parse → resolve → [permissions] → nodes
 */

import { Tokenizer } from './tokenizer.js';
import { Parser } from './parser.js';
import type { ASTNode } from './ast.js';
import type { ContextNode, StorageProvider } from '../types/index.js';
import type { Actor } from '../types/principal.js';
import type { PermissionChecker } from '../permissions/checker.js';
import type { AuditLogger } from '../permissions/audit.js';

export class ResolverError extends Error {
  constructor(message: string, public selector?: string) {
    super(message + (selector ? ` in selector: ${selector}` : ''));
    this.name = 'ResolverError';
  }
}

/**
 * Result of selector resolution with optional metadata
 */
export interface ResolveResult {
  /**
   * Resolved context nodes
   */
  nodes: ContextNode[];

  /**
   * Optional metadata about permission filtering
   */
  permissionStats?: {
    totalBeforeFilter: number;
    totalAfterFilter: number;
    excluded: number;
  };
}

export class SelectorResolver {
  private tokenizer: Tokenizer;
  private parser: Parser;

  constructor(
    private storage: StorageProvider,
    private permissionChecker?: PermissionChecker,
    private auditLogger?: AuditLogger
  ) {
    this.tokenizer = new Tokenizer();
    this.parser = new Parser();
  }

  /**
   * Resolve selector string to matching context nodes
   * Main entry point for selector resolution
   *
   * @param selector - Selector query string
   * @param actor - Optional actor for permission checking
   * @returns Resolved nodes (filtered by permissions if actor provided)
   */
  async resolve(selector: string, actor?: Actor): Promise<ContextNode[]> {
    try {
      // Step 1: Tokenize
      const tokens = this.tokenizer.tokenize(selector);

      // Step 2: Parse
      const ast = this.parser.parse(tokens);

      // Step 3: Evaluate
      let nodes = await this.evaluate(ast);

      // Step 4: Deduplicate
      nodes = this.deduplicateNodes(nodes);

      // Step 5: Permission filtering (if actor and checker provided)
      if (actor && this.permissionChecker) {
        nodes = await this.filterByPermissions(actor, nodes);
      }

      return nodes;
    } catch (error) {
      if (error instanceof Error) {
        throw new ResolverError(error.message, selector);
      }
      throw error;
    }
  }

  /**
   * Resolve with detailed result including permission statistics
   *
   * @param selector - Selector query string
   * @param actor - Optional actor for permission checking
   * @returns Result with nodes and metadata
   */
  async resolveWithStats(selector: string, actor?: Actor): Promise<ResolveResult> {
    try {
      // Step 1-4: Standard resolution
      const tokens = this.tokenizer.tokenize(selector);
      const ast = this.parser.parse(tokens);
      let nodes = await this.evaluate(ast);
      nodes = this.deduplicateNodes(nodes);

      // Track counts for stats
      const totalBeforeFilter = nodes.length;

      // Step 5: Permission filtering with stats
      if (actor && this.permissionChecker) {
        nodes = await this.filterByPermissions(actor, nodes);
      }

      return {
        nodes,
        permissionStats: actor ? {
          totalBeforeFilter,
          totalAfterFilter: nodes.length,
          excluded: totalBeforeFilter - nodes.length
        } : undefined
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new ResolverError(error.message, selector);
      }
      throw error;
    }
  }

  /**
   * Filter nodes by read permissions and audit checks
   */
  private async filterByPermissions(actor: Actor, nodes: ContextNode[]): Promise<ContextNode[]> {
    if (!this.permissionChecker) {
      return nodes;
    }

    const filtered: ContextNode[] = [];

    for (const node of nodes) {
      const result = this.permissionChecker.check(actor, 'read', node);

      // Audit the permission check
      if (this.auditLogger) {
        await this.auditLogger.log(
          this.auditLogger.createEntry({
            actor: actor.id,
            actorPrincipals: actor.principals,
            operation: 'read',
            resource: node.id,
            resourceTitle: node.title || 'Untitled',
            decision: result.allowed ? 'allow' : 'deny',
            matchedPrincipal: result.matchedPrincipal,
            reason: result.reason
          })
        );
      }

      if (result.allowed) {
        filtered.push(node);
      }
    }

    return filtered;
  }

  /**
   * Evaluate AST node to resolve matching nodes
   * Recursive evaluation of AST
   */
  private async evaluate(node: ASTNode): Promise<ContextNode[]> {
    switch (node.type) {
      case 'TAG':
        return this.resolveTag(node.value);

      case 'TITLE':
        return this.resolveTitle(node.value);

      case 'OWNER_TITLE':
        return this.resolveOwnerTitle(node.owner, node.title);

      case 'PACK':
        return this.resolvePack(node.value);

      case 'FILTER':
        return this.resolveFilter(node.key, node.value);

      case 'AND':
        return this.resolveAnd(node.left, node.right);

      case 'OR':
        return this.resolveOr(node.left, node.right);

      case 'NOT':
        return this.resolveNot(node.left, node.right);

      default:
        throw new ResolverError(`Unknown AST node type: ${(node as any).type}`);
    }
  }

  /**
   * Resolve tag selector
   * Spec: Example 1
   */
  private async resolveTag(tag: string): Promise<ContextNode[]> {
    // Ensure tag has # prefix for filter
    const tagWithPrefix = tag.startsWith('#') ? tag : `#${tag}`;
    return this.storage.listNodes({ tags: [tagWithPrefix] });
  }

  /**
   * Resolve title transclusion
   * Spec: Example 2
   */
  private async resolveTitle(title: string): Promise<ContextNode[]> {
    const node = await this.storage.getNodeByTitle(title);
    return node ? [node] : [];
  }

  /**
   * Resolve owner-scoped title
   * Spec: Example 5
   */
  private async resolveOwnerTitle(owner: string, title: string): Promise<ContextNode[]> {
    // Owner format: team:legal, user:alice, etc.
    const ownerPrincipal = owner.includes(':') ? owner : `team:${owner}`;
    const node = await this.storage.getNodeByTitle(title, ownerPrincipal);
    return node ? [node] : [];
  }

  /**
   * Resolve pack reference
   * Spec: Example 7
   *
   * TODO: Implement cycle detection for pack references
   */
  private async resolvePack(packId: string): Promise<ContextNode[]> {
    // Packs are not yet implemented in storage
    // For now, return empty array
    // In future: load pack definition and recursively resolve its query
    throw new ResolverError(`Pack resolution not yet implemented: ${packId}`);
  }

  /**
   * Resolve filter expression
   * Spec: Example 6
   */
  private async resolveFilter(key: string, value: string): Promise<ContextNode[]> {
    switch (key) {
      case 'type':
        return this.storage.listNodes({ type: value as any });

      case 'scope':
        return this.storage.listNodes({ scope: value as any });

      case 'owner':
        // Owner filter format: owner:team:sre or owner:user:alice
        const ownerPrincipal = value.includes(':') ? value : `team:${value}`;
        return this.storage.listNodes({ owners: [ownerPrincipal as any] });

      default:
        throw new ResolverError(`Unknown filter key: ${key}`);
    }
  }

  /**
   * Resolve AND operation (intersection)
   * Spec: Example 3
   */
  private async resolveAnd(left: ASTNode, right: ASTNode): Promise<ContextNode[]> {
    const [leftNodes, rightNodes] = await Promise.all([
      this.evaluate(left),
      this.evaluate(right),
    ]);

    // Intersection: nodes that appear in both sets
    return this.intersectNodes(leftNodes, rightNodes);
  }

  /**
   * Resolve OR operation (union)
   */
  private async resolveOr(left: ASTNode, right: ASTNode): Promise<ContextNode[]> {
    const [leftNodes, rightNodes] = await Promise.all([
      this.evaluate(left),
      this.evaluate(right),
    ]);

    // Union: all nodes from both sets (deduplicated)
    return this.unionNodes(leftNodes, rightNodes);
  }

  /**
   * Resolve NOT operation (difference)
   * Spec: Example 4
   */
  private async resolveNot(left: ASTNode, right: ASTNode): Promise<ContextNode[]> {
    const [leftNodes, rightNodes] = await Promise.all([
      this.evaluate(left),
      this.evaluate(right),
    ]);

    // Difference: nodes in left but not in right
    return this.differenceNodes(leftNodes, rightNodes);
  }

  /**
   * Set operation: intersection
   */
  private intersectNodes(left: ContextNode[], right: ContextNode[]): ContextNode[] {
    const rightIds = new Set(right.map(n => n.id));
    return left.filter(node => rightIds.has(node.id));
  }

  /**
   * Set operation: union
   */
  private unionNodes(left: ContextNode[], right: ContextNode[]): ContextNode[] {
    const seen = new Set<string>();
    const result: ContextNode[] = [];

    for (const node of [...left, ...right]) {
      if (!seen.has(node.id)) {
        seen.add(node.id);
        result.push(node);
      }
    }

    return result;
  }

  /**
   * Set operation: difference
   */
  private differenceNodes(left: ContextNode[], right: ContextNode[]): ContextNode[] {
    const rightIds = new Set(right.map(n => n.id));
    return left.filter(node => !rightIds.has(node.id));
  }

  /**
   * Deduplicate nodes by ID
   */
  private deduplicateNodes(nodes: ContextNode[]): ContextNode[] {
    const seen = new Set<string>();
    const result: ContextNode[] = [];

    for (const node of nodes) {
      if (!seen.has(node.id)) {
        seen.add(node.id);
        result.push(node);
      }
    }

    return result;
  }
}
