/**
 * Policy Evaluator Tests
 * Tests condition matching and policy evaluation
 */

import { PolicyEvaluator } from './evaluator.js';
import type { Policy, PolicyContext } from '../types/policy.js';
import type { ContextNode } from '../types/index.js';

describe('PolicyEvaluator - Condition Matching', () => {
  let evaluator: PolicyEvaluator;

  beforeEach(() => {
    evaluator = new PolicyEvaluator();
  });

  it('should match equality condition', () => {
    const context: PolicyContext = {
      node: { id: 'test', title: 'Test', type: 'document', owners: ['team:test'] },
      operation: 'read',
      audience: 'external'
    };

    const matches = evaluator.matchesConditions(
      [{ field: 'audience', operator: '==', value: 'external' }],
      context
    );

    expect(matches).toBe(true);
  });

  it('should match inequality condition', () => {
    const context: PolicyContext = {
      node: { id: 'test', title: 'Test', type: 'document', owners: ['team:test'] },
      operation: 'read',
      audience: 'internal'
    };

    const matches = evaluator.matchesConditions(
      [{ field: 'audience', operator: '!=', value: 'external' }],
      context
    );

    expect(matches).toBe(true);
  });

  it('should match greater than condition', () => {
    const context: PolicyContext = {
      node: {
        id: 'test',
        title: 'Test',
        type: 'document',
        owners: ['team:test'],
        metadata: { word_count: 5000 }
      },
      operation: 'read'
    };

    const matches = evaluator.matchesConditions(
      [{ field: 'node.word_count', operator: '>', value: 3000 }],
      context
    );

    expect(matches).toBe(true);
  });

  it('should match in array condition', () => {
    const context: PolicyContext = {
      node: { id: 'test', title: 'Test', type: 'document', owners: ['team:test'], scope: 'restricted' },
      operation: 'export'
    };

    const matches = evaluator.matchesConditions(
      [{ field: 'node.scope', operator: 'in', value: ['restricted', 'confidential'] }],
      context
    );

    expect(matches).toBe(true);
  });

  it('should match contains condition for arrays', () => {
    const context: PolicyContext = {
      node: {
        id: 'test',
        title: 'Test',
        type: 'document',
        owners: ['team:test'],
        tags: ['#legal', '#contract']
      },
      operation: 'read'
    };

    const matches = evaluator.matchesConditions(
      [{ field: 'node.tags', operator: 'contains', value: '#legal' }],
      context
    );

    expect(matches).toBe(true);
  });

  it('should require all conditions to match (AND logic)', () => {
    const context: PolicyContext = {
      node: { id: 'test', title: 'Test', type: 'document', owners: ['team:test'] },
      operation: 'export',
      audience: 'external'
    };

    const matches = evaluator.matchesConditions(
      [
        { field: 'audience', operator: '==', value: 'external' },
        { field: 'operation', operator: '==', value: 'export' }
      ],
      context
    );

    expect(matches).toBe(true);
  });

  it('should fail if any condition does not match', () => {
    const context: PolicyContext = {
      node: { id: 'test', title: 'Test', type: 'document', owners: ['team:test'] },
      operation: 'read',
      audience: 'external'
    };

    const matches = evaluator.matchesConditions(
      [
        { field: 'audience', operator: '==', value: 'external' },
        { field: 'operation', operator: '==', value: 'export' }
      ],
      context
    );

    expect(matches).toBe(false);
  });
});

describe('PolicyEvaluator - Policy Evaluation', () => {
  let evaluator: PolicyEvaluator;

  beforeEach(() => {
    evaluator = new PolicyEvaluator();
  });

  it('should return applicable policies', () => {
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

    const context: PolicyContext = {
      node: { id: 'test', title: 'Test', type: 'document', owners: ['team:test'] },
      operation: 'read',
      audience: 'external'
    };

    const result = evaluator.evaluate(policies, context);

    expect(result.applicablePolicies).toHaveLength(1);
    expect(result.applicablePolicies[0].id).toBe('policy:test.one');
  });

  it('should detect deny policies', () => {
    const policies: Policy[] = [
      {
        id: 'policy:deny.export',
        when: [{ field: 'node.scope', operator: '==', value: 'restricted' }],
        then: [{ type: 'deny', deny: 'export' }]
      }
    ];

    const context: PolicyContext = {
      node: { id: 'test', title: 'Test', type: 'document', owners: ['team:test'], scope: 'restricted' },
      operation: 'export'
    };

    const result = evaluator.evaluate(policies, context);

    expect(result.denied).toBe(true);
    expect(result.denyPolicy).toBe('policy:deny.export');
    expect(result.denyReason).toContain('denies export');
  });

  it('should sort by priority', () => {
    const policies: Policy[] = [
      {
        id: 'policy:low',
        priority: 1,
        when: [{ field: 'audience', operator: '==', value: 'external' }],
        then: [{ type: 'transform', transform: 'redact_pii' }]
      },
      {
        id: 'policy:high',
        priority: 10,
        when: [{ field: 'audience', operator: '==', value: 'external' }],
        then: [{ type: 'transform', transform: 'add_watermark' }]
      }
    ];

    const context: PolicyContext = {
      node: { id: 'test', title: 'Test', type: 'document', owners: ['team:test'] },
      operation: 'read',
      audience: 'external'
    };

    const result = evaluator.evaluate(policies, context);

    expect(result.applicablePolicies).toHaveLength(2);
    expect(result.applicablePolicies[0].id).toBe('policy:high');
    expect(result.applicablePolicies[1].id).toBe('policy:low');
  });
});

describe('PolicyEvaluator - Context Enrichment', () => {
  let evaluator: PolicyEvaluator;

  beforeEach(() => {
    evaluator = new PolicyEvaluator();
  });

  it('should calculate node age in days', () => {
    const node = {
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
    };

    const age = evaluator.calculateNodeAge(node);

    expect(age).toBeGreaterThanOrEqual(29);
    expect(age).toBeLessThanOrEqual(31);
  });

  it('should enrich context with age_days', () => {
    const context: PolicyContext = {
      node: {
        id: 'test',
        title: 'Test',
        type: 'document',
        owners: ['team:test'],
        created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
      },
      operation: 'read'
    };

    const enriched = evaluator.enrichContext(context);

    expect(enriched.node.metadata?.age_days).toBeGreaterThanOrEqual(364);
    expect(enriched.node.metadata?.age_days).toBeLessThanOrEqual(366);
  });

  it('should match conditions on enriched fields', () => {
    const policies: Policy[] = [
      {
        id: 'policy:old.docs',
        when: [{ field: 'node.age_days', operator: '>', value: 180 }],
        then: [{ type: 'transform', transform: 'add_warning' }]
      }
    ];

    const context: PolicyContext = {
      node: {
        id: 'test',
        title: 'Test',
        type: 'document',
        owners: ['team:test'],
        created_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString()
      },
      operation: 'read'
    };

    const enriched = evaluator.enrichContext(context);
    const result = evaluator.evaluate(policies, enriched);

    expect(result.applicablePolicies).toHaveLength(1);
    expect(result.applicablePolicies[0].id).toBe('policy:old.docs');
  });
});
