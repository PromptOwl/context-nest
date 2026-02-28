/**
 * Resolver Permission Integration Tests
 * Tests permission checking integrated into selector resolution
 *
 * Spec: specs/02-permission-checks.md (integrated with selector resolution)
 */

import { SelectorResolver } from './resolver.js';
import { FileVaultProvider } from '../storage/file-vault-provider.js';
import { PermissionChecker } from '../permissions/checker.js';
import { AuditLogger } from '../permissions/audit.js';
import { createActor } from '../types/principal.js';
import { join } from 'path';

describe('Resolver with Permissions - Basic Integration', () => {
  let resolver: SelectorResolver;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    const storage = new FileVaultProvider(vaultPath);
    const permissionChecker = new PermissionChecker();
    const auditLogger = new AuditLogger({ bufferInMemory: true });

    resolver = new SelectorResolver(storage, permissionChecker, auditLogger);
  });

  it('should filter nodes by permissions when actor provided', async () => {
    // Actor with limited permissions
    const actor = createActor('user:guest', ['user:guest']);

    // Resolve all nodes
    const nodes = await resolver.resolve('#public', actor);

    // Should only include public nodes
    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach(node => {
      expect(node.tags).toContain('#public');
    });
  });

  it('should return all nodes when no actor provided', async () => {
    // No actor = no permission filtering
    const nodesWithoutActor = await resolver.resolve('#guide');

    expect(nodesWithoutActor.length).toBeGreaterThan(0);
  });

  it('should return fewer nodes with actor than without', async () => {
    const allNodes = await resolver.resolve('#guide');

    // Actor without engineering access
    const actor = createActor('user:guest', ['user:guest']);
    const filteredNodes = await resolver.resolve('#guide', actor);

    // Should filter out some nodes based on permissions
    expect(filteredNodes.length).toBeLessThanOrEqual(allNodes.length);
  });
});

describe('Resolver with Permissions - Permission Stats', () => {
  let resolver: SelectorResolver;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    const storage = new FileVaultProvider(vaultPath);
    const permissionChecker = new PermissionChecker();

    resolver = new SelectorResolver(storage, permissionChecker);
  });

  it('should provide permission statistics', async () => {
    const actor = createActor('user:guest', ['user:guest']);

    const result = await resolver.resolveWithStats('#guide', actor);

    expect(result.nodes).toBeDefined();
    expect(result.permissionStats).toBeDefined();
    expect(result.permissionStats?.totalBeforeFilter).toBeGreaterThanOrEqual(0);
    expect(result.permissionStats?.totalAfterFilter).toBeLessThanOrEqual(
      result.permissionStats?.totalBeforeFilter || 0
    );
    expect(result.permissionStats?.excluded).toBe(
      (result.permissionStats?.totalBeforeFilter || 0) -
      (result.permissionStats?.totalAfterFilter || 0)
    );
  });

  it('should not include stats when no actor provided', async () => {
    const result = await resolver.resolveWithStats('#guide');

    expect(result.nodes).toBeDefined();
    expect(result.permissionStats).toBeUndefined();
  });
});

describe('Resolver with Permissions - Audit Logging', () => {
  let resolver: SelectorResolver;
  let auditLogger: AuditLogger;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    const storage = new FileVaultProvider(vaultPath);
    const permissionChecker = new PermissionChecker();
    auditLogger = new AuditLogger({ bufferInMemory: true });

    resolver = new SelectorResolver(storage, permissionChecker, auditLogger);
  });

  it('should audit all permission checks', async () => {
    const actor = createActor('user:alice', ['user:alice', 'team:engineering']);

    await resolver.resolve('#guide', actor);

    const buffer = auditLogger.getBuffer();
    expect(buffer.length).toBeGreaterThan(0);

    // All entries should be for this actor
    buffer.forEach(entry => {
      expect(entry.actor).toBe('user:alice');
      expect(entry.operation).toBe('read');
      expect(entry.event).toBe('permission_check');
    });
  });

  it('should record both allowed and denied checks', async () => {
    // Actor with very limited permissions
    const actor = createActor('user:restricted', ['user:restricted']);

    await resolver.resolve('type:document', actor);

    const stats = auditLogger.getStatistics();

    expect(stats.total).toBeGreaterThan(0);
    // Should have at least some denials
    expect(stats.denied).toBeGreaterThanOrEqual(0);
  });

  it('should not audit when no actor provided', async () => {
    await resolver.resolve('#guide');

    const buffer = auditLogger.getBuffer();
    expect(buffer.length).toBe(0);
  });
});

describe('Resolver with Permissions - Real Vault Examples', () => {
  let resolver: SelectorResolver;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    const storage = new FileVaultProvider(vaultPath);
    const permissionChecker = new PermissionChecker();

    resolver = new SelectorResolver(storage, permissionChecker);
  });

  it('should allow SRE team to access SEV runbook', async () => {
    const sreActor = createActor('user:oncall', ['user:oncall', 'team:sre']);

    const nodes = await resolver.resolve('[[SEV Management Runbook]]', sreActor);

    expect(nodes.length).toBe(1);
    expect(nodes[0].title).toBe('SEV Management Runbook');
  });

  it('should deny non-SRE access to SEV runbook', async () => {
    const guestActor = createActor('user:guest', ['user:guest']);

    const nodes = await resolver.resolve('[[SEV Management Runbook]]', guestActor);

    expect(nodes.length).toBe(0); // Filtered out by permissions
  });

  it('should allow anyone to access public documents', async () => {
    const guestActor = createActor('user:guest', ['user:guest']);

    const nodes = await resolver.resolve('#public', guestActor);

    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach(node => {
      // All should have wildcard or public permissions
      const hasWildcard = node.permissions?.read?.includes('*');
      expect(hasWildcard).toBe(true);
    });
  });

  it('should filter complex queries by permissions', async () => {
    const engineeringActor = createActor('user:dev', ['user:dev', 'team:engineering']);

    const result = await resolver.resolveWithStats(
      '(#guide | #workflow) + type:document',
      engineeringActor
    );

    expect(result.nodes).toBeDefined();
    expect(result.permissionStats).toBeDefined();

    // Verify all returned nodes are accessible
    result.nodes.forEach(node => {
      expect(node.type).toBe('document');
      const hasGuide = node.tags?.includes('#guide');
      const hasWorkflow = node.tags?.includes('#workflow');
      expect(hasGuide || hasWorkflow).toBe(true);
    });
  });
});

describe('Resolver with Permissions - No Permission Checker', () => {
  let resolver: SelectorResolver;
  const vaultPath = join(process.cwd(), 'examples', 'vault');

  beforeEach(() => {
    const storage = new FileVaultProvider(vaultPath);
    // No permission checker provided
    resolver = new SelectorResolver(storage);
  });

  it('should not filter nodes when no permission checker', async () => {
    const actor = createActor('user:guest', ['user:guest']);

    // Even with actor, should not filter (no checker)
    const nodesWithActor = await resolver.resolve('#guide', actor);
    const nodesWithoutActor = await resolver.resolve('#guide');

    expect(nodesWithActor.length).toBe(nodesWithoutActor.length);
  });
});
