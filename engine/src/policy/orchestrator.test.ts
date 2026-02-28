/**
 * Policy Orchestrator Tests
 * Tests full policy processing pipeline
 */

import { PolicyOrchestrator } from './orchestrator.js';
import { TransformRegistry } from './transforms.js';
import type { Policy, PolicyContext } from '../types/policy.js';
import type { ContextNode } from '../types/index.js';
import type { Principal } from '../types/principal.js';

describe('PolicyOrchestrator - Basic Processing', () => {
  it('should process nodes with no policies', async () => {
    const orchestrator = new PolicyOrchestrator([]);

    const nodes: ContextNode[] = [
      { id: 'test1', title: 'Test 1', type: 'document', owners: ['team:test'], content: 'Hello world' }
    ];

    const result = await orchestrator.process(nodes, { operation: 'read' });

    expect(result.nodes).toHaveLength(1);
    expect(result.manifest.policiesApplied).toHaveLength(0);
    expect(result.manifest.transformsApplied).toHaveLength(0);
  });

  it('should apply transform policy', async () => {
    const policies: Policy[] = [
      {
        id: 'policy:test.redact',
        when: [{ field: 'audience', operator: '==', value: 'external' }],
        then: [{ type: 'transform', transform: 'redact_emails' }]
      }
    ];

    const orchestrator = new PolicyOrchestrator(policies);

    const nodes: ContextNode[] = [
      {
        id: 'test1',
        title: 'Test 1',
        type: 'document',
        owners: ['team:test'],
        content: 'Contact us at support@example.com'
      }
    ];

    const result = await orchestrator.process(nodes, {
      operation: 'read',
      audience: 'external'
    });

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].content).toContain('[REDACTED_EMAIL]');
    expect(result.nodes[0].content).not.toContain('support@example.com');
    expect(result.manifest.policiesApplied).toContain('policy:test.redact');
    expect(result.manifest.transformsApplied).toHaveLength(1);
    expect(result.manifest.stats?.nodesTransformed).toBe(1);
  });

  it('should apply multiple transforms in order', async () => {
    const policies: Policy[] = [
      {
        id: 'policy:test.multi',
        when: [{ field: 'audience', operator: '==', value: 'external' }],
        then: [
          { type: 'transform', transform: 'redact_emails' },
          { type: 'transform', transform: 'add_watermark', params: { text: 'CONFIDENTIAL', position: 'top' } }
        ]
      }
    ];

    const orchestrator = new PolicyOrchestrator(policies);

    const nodes: ContextNode[] = [
      {
        id: 'test1',
        title: 'Test 1',
        type: 'document',
        owners: ['team:test'],
        content: 'Email: test@example.com'
      }
    ];

    const result = await orchestrator.process(nodes, {
      operation: 'read',
      audience: 'external'
    });

    expect(result.nodes[0].content).toContain('[REDACTED_EMAIL]');
    expect(result.nodes[0].content).toContain('CONFIDENTIAL');
    expect(result.manifest.transformsApplied).toHaveLength(2);
    expect(result.manifest.transformsApplied[0].order).toBe(1);
    expect(result.manifest.transformsApplied[1].order).toBe(2);
  });
});

describe('PolicyOrchestrator - Deny Policies', () => {
  it('should exclude node when deny policy matches', async () => {
    const policies: Policy[] = [
      {
        id: 'policy:deny.export',
        when: [{ field: 'node.scope', operator: '==', value: 'restricted' }],
        then: [{ type: 'deny', deny: 'export' }]
      }
    ];

    const orchestrator = new PolicyOrchestrator(policies);

    const nodes: ContextNode[] = [
      {
        id: 'test1',
        title: 'Restricted Doc',
        type: 'document',
        owners: ['team:test'],
        scope: 'restricted',
        content: 'Sensitive information'
      }
    ];

    const result = await orchestrator.process(nodes, { operation: 'export' });

    expect(result.nodes).toHaveLength(0);
    expect(result.manifest.nodesExcluded).toHaveLength(1);
    expect(result.manifest.nodesExcluded[0].policy).toBe('policy:deny.export');
    expect(result.manifest.stats?.nodesExcluded).toBe(1);
  });

  it('should include node when deny policy does not match operation', async () => {
    const policies: Policy[] = [
      {
        id: 'policy:deny.export',
        when: [{ field: 'node.scope', operator: '==', value: 'restricted' }],
        then: [{ type: 'deny', deny: 'export' }]
      }
    ];

    const orchestrator = new PolicyOrchestrator(policies);

    const nodes: ContextNode[] = [
      {
        id: 'test1',
        title: 'Restricted Doc',
        type: 'document',
        owners: ['team:test'],
        scope: 'restricted',
        content: 'Sensitive information'
      }
    ];

    const result = await orchestrator.process(nodes, { operation: 'read' });

    expect(result.nodes).toHaveLength(1);
    expect(result.manifest.nodesExcluded).toHaveLength(0);
  });
});

describe('PolicyOrchestrator - Approval Requirements', () => {
  it('should exclude node requiring approval', async () => {
    const policies: Policy[] = [
      {
        id: 'policy:approval.required',
        when: [{ field: 'node.scope', operator: '==', value: 'confidential' }],
        then: [{ type: 'require_approval', requireApproval: ['role:manager' as Principal] }]
      }
    ];

    const orchestrator = new PolicyOrchestrator(policies);

    const nodes: ContextNode[] = [
      {
        id: 'test1',
        title: 'Confidential Doc',
        type: 'document',
        owners: ['team:test'],
        scope: 'confidential',
        content: 'Confidential information'
      }
    ];

    const result = await orchestrator.process(nodes, { operation: 'read' });

    expect(result.nodes).toHaveLength(0);
    expect(result.manifest.nodesExcluded).toHaveLength(1);
    expect(result.manifest.nodesExcluded[0].reason).toBe('Approval required');
    expect(result.manifest.approvalsRequired).toHaveLength(1);
    expect(result.manifest.approvalsRequired![0].policy).toBe('policy:approval.required');
  });
});

describe('PolicyOrchestrator - Manifest Tracking', () => {
  it('should track all transform details in manifest', async () => {
    const policies: Policy[] = [
      {
        id: 'policy:test.track',
        when: [{ field: 'audience', operator: '==', value: 'external' }],
        then: [{ type: 'transform', transform: 'redact_pii' }]
      }
    ];

    const orchestrator = new PolicyOrchestrator(policies);

    const nodes: ContextNode[] = [
      {
        id: 'test1',
        title: 'Test Document',
        type: 'document',
        owners: ['team:test'],
        content: 'Contact: john@example.com, SSN: 123-45-6789'
      }
    ];

    const result = await orchestrator.process(nodes, {
      operation: 'read',
      audience: 'external'
    });

    expect(result.manifest.transformsApplied).toHaveLength(1);

    const transform = result.manifest.transformsApplied[0];
    expect(transform.nodeId).toBe('test1');
    expect(transform.nodeTitle).toBe('Test Document');
    expect(transform.transform).toBe('redact_pii');
    expect(transform.order).toBe(1);
    expect(transform.originalChecksum).toBeDefined();
    expect(transform.resultChecksum).toBeDefined();
    expect(transform.originalChecksum).not.toBe(transform.resultChecksum);
    expect(transform.originalCount?.words).toBeGreaterThan(0);
    expect(transform.resultCount?.words).toBeGreaterThan(0);
  });

  it('should track statistics correctly', async () => {
    const policies: Policy[] = [
      {
        id: 'policy:test.stats',
        when: [{ field: 'audience', operator: '==', value: 'external' }],
        then: [{ type: 'transform', transform: 'redact_emails' }]
      },
      {
        id: 'policy:deny.restricted',
        when: [{ field: 'node.scope', operator: '==', value: 'restricted' }],
        then: [{ type: 'deny', deny: 'read' }]
      }
    ];

    const orchestrator = new PolicyOrchestrator(policies);

    const nodes: ContextNode[] = [
      {
        id: 'test1',
        title: 'Public Doc',
        type: 'document',
        owners: ['team:test'],
        content: 'Email: public@example.com'
      },
      {
        id: 'test2',
        title: 'Restricted Doc',
        type: 'document',
        owners: ['team:test'],
        scope: 'restricted',
        content: 'Secret data'
      }
    ];

    const result = await orchestrator.process(nodes, {
      operation: 'read',
      audience: 'external'
    });

    expect(result.manifest.stats?.totalNodes).toBe(2);
    expect(result.manifest.stats?.nodesTransformed).toBe(1); // Only test1 matches external audience
    expect(result.manifest.stats?.nodesExcluded).toBe(1); // test2 is restricted
    expect(result.manifest.stats?.totalTransforms).toBe(1);
  });
});

describe('PolicyOrchestrator - Priority Handling', () => {
  it('should apply higher priority policies first', async () => {
    const policies: Policy[] = [
      {
        id: 'policy:low',
        priority: 1,
        when: [{ field: 'audience', operator: '==', value: 'external' }],
        then: [{ type: 'transform', transform: 'add_watermark', params: { text: 'LOW' } }]
      },
      {
        id: 'policy:high',
        priority: 10,
        when: [{ field: 'audience', operator: '==', value: 'external' }],
        then: [{ type: 'transform', transform: 'redact_emails' }]
      }
    ];

    const orchestrator = new PolicyOrchestrator(policies);

    const nodes: ContextNode[] = [
      {
        id: 'test1',
        title: 'Test',
        type: 'document',
        owners: ['team:test'],
        content: 'Email: test@example.com'
      }
    ];

    const result = await orchestrator.process(nodes, {
      operation: 'read',
      audience: 'external'
    });

    // High priority (redact) applied first, then low priority (watermark)
    expect(result.manifest.policiesApplied).toEqual(['policy:high', 'policy:low']);
    expect(result.nodes[0].content).toContain('[REDACTED_EMAIL]');
    expect(result.nodes[0].content).toContain('LOW');
  });
});

describe('PolicyOrchestrator - Dry Run', () => {
  it('should preview policies without applying them', async () => {
    const policies: Policy[] = [
      {
        id: 'policy:test.preview',
        when: [{ field: 'audience', operator: '==', value: 'external' }],
        then: [{ type: 'transform', transform: 'redact_emails' }]
      }
    ];

    const orchestrator = new PolicyOrchestrator(policies);

    const nodes: ContextNode[] = [
      {
        id: 'test1',
        title: 'Test',
        type: 'document',
        owners: ['team:test'],
        content: 'Email: test@example.com'
      },
      {
        id: 'test2',
        title: 'Test 2',
        type: 'document',
        owners: ['team:test'],
        content: 'No email here'
      }
    ];

    const preview = await orchestrator.dryRun(nodes, {
      operation: 'read',
      audience: 'external'
    });

    expect(preview.wouldApply).toContain('policy:test.preview');
    expect(preview.wouldTransform).toBe(2); // Both nodes match audience
    expect(preview.wouldExclude).toBe(0);
    expect(preview.wouldRequireApproval).toBe(0);

    // Original nodes unchanged
    expect(nodes[0].content).toContain('test@example.com');
  });

  it('should preview deny policies', async () => {
    const policies: Policy[] = [
      {
        id: 'policy:deny.test',
        when: [{ field: 'node.scope', operator: '==', value: 'restricted' }],
        then: [{ type: 'deny', deny: 'export' }]
      }
    ];

    const orchestrator = new PolicyOrchestrator(policies);

    const nodes: ContextNode[] = [
      {
        id: 'test1',
        title: 'Restricted',
        type: 'document',
        owners: ['team:test'],
        scope: 'restricted',
        content: 'Secret'
      }
    ];

    const preview = await orchestrator.dryRun(nodes, { operation: 'export' });

    expect(preview.wouldExclude).toBe(1);
    expect(preview.wouldTransform).toBe(0);
  });
});

describe('PolicyOrchestrator - Context Enrichment', () => {
  it('should enrich context with age_days', async () => {
    const policies: Policy[] = [
      {
        id: 'policy:old.docs',
        when: [{ field: 'node.age_days', operator: '>', value: 180 }],
        then: [{ type: 'transform', transform: 'add_warning', params: { message: '⚠️ This document may be outdated' } }]
      }
    ];

    const orchestrator = new PolicyOrchestrator(policies);

    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();

    const nodes: ContextNode[] = [
      {
        id: 'test1',
        title: 'Old Doc',
        type: 'document',
        owners: ['team:test'],
        created_at: oldDate,
        content: 'This is old content'
      }
    ];

    const result = await orchestrator.process(nodes, { operation: 'read' });

    expect(result.nodes[0].content).toContain('⚠️ This document may be outdated');
    expect(result.manifest.policiesApplied).toContain('policy:old.docs');
  });
});

describe('PolicyOrchestrator - getPoliciesForNode', () => {
  it('should return applicable policies for specific node', () => {
    const policies: Policy[] = [
      {
        id: 'policy:test.one',
        when: [{ field: 'audience', operator: '==', value: 'external' }],
        then: [{ type: 'transform', transform: 'redact_pii' }]
      },
      {
        id: 'policy:test.two',
        when: [{ field: 'audience', operator: '==', value: 'internal' }],
        then: [{ type: 'transform', transform: 'add_watermark' }]
      }
    ];

    const orchestrator = new PolicyOrchestrator(policies);

    const node: ContextNode = {
      id: 'test1',
      title: 'Test',
      type: 'document',
      owners: ['team:test'],
      content: 'Content'
    };

    const applicable = orchestrator.getPoliciesForNode(node, {
      operation: 'read',
      audience: 'external'
    });

    expect(applicable).toHaveLength(1);
    expect(applicable[0].id).toBe('policy:test.one');
  });
});
