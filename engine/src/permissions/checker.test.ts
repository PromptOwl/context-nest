/**
 * Permission Checker Tests
 * Based on specs/02-permission-checks.md examples
 *
 * Tests all 15 permission check scenarios from the specification.
 */

import { PermissionChecker, PermissionError } from './checker.js';
import { createActor } from '../types/principal.js';
import type { ContextNode } from '../types/index.js';
import type { Principal } from '../types/principal.js';

describe('PermissionChecker - Basic Read Permissions', () => {
  let checker: PermissionChecker;

  beforeEach(() => {
    checker = new PermissionChecker();
  });

  // Spec Example 1: Basic Read Permission - Allowed
  it('should allow read when actor has matching principal', () => {
    const node: ContextNode = {
      id: 'ulid:01JCQM2K7X8PQR5TVWXYZ12345',
      title: 'SEV Runbook',
      type: 'document',
      owners: ['team:sre' as any],
      permissions: {
        read: ['team:sre', 'role:exec_view'],
        write: ['user:misha']
      }
    };

    const actor = createActor('agent:web1', ['team:sre', 'agent:web1']);

    const result = checker.check(actor, 'read', node);

    expect(result.allowed).toBe(true);
    expect(result.matchedPrincipal).toBe('team:sre');
    expect(result.reason).toContain('team:sre');
  });

  // Spec Example 2: Basic Read Permission - Denied
  it('should deny read when actor has no matching principal', () => {
    const node: ContextNode = {
      id: 'ulid:01JCQM2K7X8PQR5TVWXYZ12345',
      title: 'SEV Runbook',
      type: 'document',
      owners: ['team:sre' as any],
      permissions: {
        read: ['team:sre', 'role:exec_view']
      }
    };

    const actor = createActor('agent:web2', ['team:engineering', 'agent:web2']);

    const result = checker.check(actor, 'read', node);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('No matching principals');
    expect(result.requiredPrincipals).toEqual(['team:sre', 'role:exec_view']);
    expect(result.actorPrincipals).toEqual(['team:engineering', 'agent:web2']);
  });

  // Spec Example 3: Multiple Nodes - Partial Access
  it('should filter nodes by read permission', () => {
    const publicNode: ContextNode = {
      id: 'ulid:01A',
      title: 'Public FAQ',
      type: 'document',
      owners: ['team:content' as any],
      permissions: { read: ['*'] }
    };

    const internalNode: ContextNode = {
      id: 'ulid:01B',
      title: 'Internal Guide',
      type: 'document',
      owners: ['team:engineering' as any],
      permissions: { read: ['team:engineering'] }
    };

    const restrictedNode: ContextNode = {
      id: 'ulid:01C',
      title: 'Restricted Doc',
      type: 'document',
      owners: ['team:admin' as any],
      permissions: { read: ['role:admin'] }
    };

    const actor = createActor('user:alice', ['user:alice', 'team:engineering']);

    const nodes = [publicNode, internalNode, restrictedNode];
    const filtered = checker.filterByPermission(actor, nodes);

    expect(filtered).toHaveLength(2);
    expect(filtered).toContainEqual(publicNode);
    expect(filtered).toContainEqual(internalNode);
    expect(filtered).not.toContainEqual(restrictedNode);
  });
});

describe('PermissionChecker - Write and Export Permissions', () => {
  let checker: PermissionChecker;

  beforeEach(() => {
    checker = new PermissionChecker();
  });

  // Spec Example 4: Write Permission Check
  it('should deny write when actor lacks write permission', () => {
    const node: ContextNode = {
      id: 'ulid:01JCQM5N9P2QR6TVWXYZ45678',
      title: 'Glossary',
      type: 'glossary',
      owners: ['team:content' as any],
      permissions: {
        read: ['*'],
        write: ['team:content', 'user:misha']
      }
    };

    const actor = createActor('user:bob', ['user:bob', 'team:engineering']);

    const result = checker.check(actor, 'write', node);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('No matching principals');
  });

  // Spec Example 5: Export Permission - Default Deny
  it('should deny export when no export permissions defined', () => {
    const node: ContextNode = {
      id: 'ulid:01CD',
      title: 'Financial Report',
      type: 'document',
      owners: ['team:finance' as any],
      permissions: {
        read: ['team:finance', 'role:exec']
        // Note: No export permissions
      }
    };

    const actor = createActor('user:cfo', ['user:cfo', 'role:exec']);

    const result = checker.check(actor, 'export', node);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('No export permissions defined');
  });

  // Spec Example 6: Export Permission - Explicit Allow
  it('should allow export when explicitly granted', () => {
    const node: ContextNode = {
      id: 'ulid:01EF',
      title: 'Public Whitepaper',
      type: 'document',
      owners: ['team:marketing' as any],
      permissions: {
        read: ['*'],
        export: ['*']
      }
    };

    const actor = createActor('user:guest', ['user:guest']);

    const result = checker.check(actor, 'export', node);

    expect(result.allowed).toBe(true);
    expect(result.matchedPrincipal).toBe('*');
  });
});

describe('PermissionChecker - Role and Agent Permissions', () => {
  let checker: PermissionChecker;

  beforeEach(() => {
    checker = new PermissionChecker();
  });

  // Spec Example 7: Role-Based Access
  it('should allow access based on role', () => {
    const node: ContextNode = {
      id: 'ulid:01GH',
      title: 'Compliance Checklist',
      type: 'document',
      owners: ['team:legal' as any],
      permissions: {
        read: ['role:compliance', 'role:admin'],
        export: ['role:compliance']
      }
    };

    const actor = createActor('user:auditor', ['user:auditor', 'role:compliance']);

    const readResult = checker.check(actor, 'read', node);
    const exportResult = checker.check(actor, 'export', node);

    expect(readResult.allowed).toBe(true);
    expect(readResult.matchedPrincipal).toBe('role:compliance');

    expect(exportResult.allowed).toBe(true);
    expect(exportResult.matchedPrincipal).toBe('role:compliance');
  });

  // Spec Example 8: Agent-Specific Permissions
  it('should handle agent-specific permissions', () => {
    const node: ContextNode = {
      id: 'ulid:01IJ',
      title: 'API Keys',
      type: 'document',
      owners: ['user:misha' as any],
      permissions: {
        read: ['agent:trusted_bot', 'user:misha'],
        export: ['user:misha'] // Never exportable by agents
      }
    };

    const agent = createActor('agent:trusted_bot', ['agent:trusted_bot']);

    const readResult = checker.check(agent, 'read', node);
    const exportResult = checker.check(agent, 'export', node);

    expect(readResult.allowed).toBe(true);
    expect(readResult.matchedPrincipal).toBe('agent:trusted_bot');

    expect(exportResult.allowed).toBe(false);
    expect(exportResult.reason).toContain('No matching principals');
  });

  // Spec Example 9: Hierarchical Team Permissions
  it('should handle multiple principals correctly', () => {
    const node: ContextNode = {
      id: 'ulid:01KL',
      title: 'Company Strategy',
      type: 'document',
      owners: ['team:leadership' as any],
      permissions: {
        read: ['team:leadership']
      }
    };

    const actor = createActor('user:director', [
      'user:director',
      'team:leadership',
      'team:engineering'
    ]);

    const result = checker.check(actor, 'read', node);

    expect(result.allowed).toBe(true);
    expect(result.matchedPrincipal).toBe('team:leadership');
  });
});

describe('PermissionChecker - Wildcard and Edge Cases', () => {
  let checker: PermissionChecker;

  beforeEach(() => {
    checker = new PermissionChecker();
  });

  // Spec Example 10: Wildcard Permissions
  it('should allow any actor with wildcard permission', () => {
    const node: ContextNode = {
      id: 'ulid:01MN',
      title: 'Public Roadmap',
      type: 'document',
      owners: ['team:product' as any],
      permissions: {
        read: ['*'],
        write: ['team:product'],
        export: ['*']
      }
    };

    const actor = createActor('user:anonymous', ['user:anonymous']);

    const readResult = checker.check(actor, 'read', node);
    const exportResult = checker.check(actor, 'export', node);
    const writeResult = checker.check(actor, 'write', node);

    expect(readResult.allowed).toBe(true);
    expect(readResult.matchedPrincipal).toBe('*');

    expect(exportResult.allowed).toBe(true);
    expect(exportResult.matchedPrincipal).toBe('*');

    expect(writeResult.allowed).toBe(false);
  });

  // Spec Example 11: Empty Permissions - Deny All
  it('should deny all when no permissions defined', () => {
    const node: ContextNode = {
      id: 'ulid:01OP',
      title: 'Draft Doc',
      type: 'document',
      owners: ['user:author' as any]
      // No permissions field
    };

    const actor = createActor('user:admin', ['user:admin', 'role:admin']);

    const result = checker.check(actor, 'read', node);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('No read permissions defined');
  });
});

describe('PermissionChecker - Helper Methods', () => {
  let checker: PermissionChecker;

  beforeEach(() => {
    checker = new PermissionChecker();
  });

  it('should throw error with checkOrThrow when denied', () => {
    const node: ContextNode = {
      id: 'ulid:01QR',
      title: 'Secret Document',
      type: 'document',
      owners: ['team:admin' as any],
      permissions: {
        read: ['role:admin']
      }
    };

    const actor = createActor('user:guest', ['user:guest']);

    expect(() => {
      checker.checkOrThrow(actor, 'read', node);
    }).toThrow(PermissionError);

    expect(() => {
      checker.checkOrThrow(actor, 'read', node);
    }).toThrow(/Permission denied.*cannot read/);
  });

  it('should not throw error with checkOrThrow when allowed', () => {
    const node: ContextNode = {
      id: 'ulid:01ST',
      title: 'Public Document',
      type: 'document',
      owners: ['team:content' as any],
      permissions: {
        read: ['*']
      }
    };

    const actor = createActor('user:guest', ['user:guest']);

    expect(() => {
      checker.checkOrThrow(actor, 'read', node);
    }).not.toThrow();
  });

  it('should check multiple operations at once', () => {
    const node: ContextNode = {
      id: 'ulid:01UV',
      title: 'Mixed Permissions',
      type: 'document',
      owners: ['team:content' as any],
      permissions: {
        read: ['*'],
        write: ['team:content'],
        export: ['role:admin']
      }
    };

    const actor = createActor('user:editor', ['user:editor', 'team:content']);

    const results = checker.checkMultiple(actor, ['read', 'write', 'export'], node);

    expect(results.read.allowed).toBe(true);
    expect(results.write.allowed).toBe(true);
    expect(results.export.allowed).toBe(false);
  });

  it('should provide statistics about filtering', () => {
    const nodes: ContextNode[] = [
      {
        id: 'ulid:01A',
        title: 'Public 1',
        type: 'document',
        owners: ['team:content' as any],
        permissions: { read: ['*'] }
      },
      {
        id: 'ulid:01B',
        title: 'Public 2',
        type: 'document',
        owners: ['team:content' as any],
        permissions: { read: ['*'] }
      },
      {
        id: 'ulid:01C',
        title: 'Team Only',
        type: 'document',
        owners: ['team:engineering' as any],
        permissions: { read: ['team:engineering'] }
      },
      {
        id: 'ulid:01D',
        title: 'Admin Only',
        type: 'document',
        owners: ['team:admin' as any],
        permissions: { read: ['role:admin'] }
      },
      {
        id: 'ulid:01E',
        title: 'No Permissions',
        type: 'document',
        owners: ['user:author' as any]
      }
    ];

    const actor = createActor('user:dev', ['user:dev', 'team:engineering']);

    const stats = checker.getFilterStatistics(actor, nodes);

    expect(stats.total).toBe(5);
    expect(stats.allowed).toBe(3); // 2 public + 1 team
    expect(stats.denied).toBe(2);  // 1 admin + 1 no permissions
    expect(stats.deniedReasons).toBeDefined();
  });
});
