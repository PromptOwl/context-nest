/**
 * Audit Logger Tests
 * Tests audit trail functionality for permission checks
 *
 * Spec: specs/02-permission-checks.md - Example 15
 */

import { AuditLogger } from './audit.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';

describe('AuditLogger - Basic Logging', () => {
  it('should log permission check to memory buffer', async () => {
    const logger = new AuditLogger({ bufferInMemory: true });

    await logger.log({
      timestamp: '2025-10-28T20:15:42Z',
      event: 'permission_check',
      operation: 'read',
      actor: 'agent:web1',
      actorPrincipals: ['agent:web1', 'team:sre'],
      resource: 'ulid:01JCQM2K7X8PQR5TVWXYZ12345',
      resourceTitle: 'SEV Runbook',
      decision: 'allow',
      matchedPrincipal: 'team:sre'
    });

    const buffer = logger.getBuffer();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].actor).toBe('agent:web1');
    expect(buffer[0].decision).toBe('allow');
    expect(buffer[0].matchedPrincipal).toBe('team:sre');
  });

  it('should create audit entry from parameters', () => {
    const logger = new AuditLogger();

    const entry = logger.createEntry({
      actor: 'user:alice',
      actorPrincipals: ['user:alice', 'team:engineering'],
      operation: 'read',
      resource: 'ulid:01ABC',
      resourceTitle: 'Test Document',
      decision: 'allow',
      matchedPrincipal: 'team:engineering'
    });

    expect(entry.event).toBe('permission_check');
    expect(entry.actor).toBe('user:alice');
    expect(entry.decision).toBe('allow');
    expect(entry.timestamp).toBeDefined();
  });
});

describe('AuditLogger - File Logging', () => {
  let logPath: string;

  beforeEach(() => {
    logPath = join(tmpdir(), `audit-test-${Date.now()}.jsonl`);
  });

  afterEach(async () => {
    if (existsSync(logPath)) {
      await rm(logPath);
    }
  });

  it('should write audit entries to file', async () => {
    const logger = new AuditLogger({ logPath, bufferInMemory: false });

    await logger.log({
      timestamp: '2025-10-28T20:15:42Z',
      event: 'permission_check',
      operation: 'read',
      actor: 'user:alice',
      actorPrincipals: ['user:alice', 'team:engineering'],
      resource: 'ulid:01ABC',
      resourceTitle: 'Test Doc',
      decision: 'allow',
      matchedPrincipal: 'user:alice'
    });

    expect(existsSync(logPath)).toBe(true);

    const content = await readFile(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);

    const entry = JSON.parse(lines[0]);
    expect(entry.actor).toBe('user:alice');
    expect(entry.decision).toBe('allow');
  });

  it('should append multiple entries to file', async () => {
    const logger = new AuditLogger({ logPath, bufferInMemory: false });

    await logger.log({
      timestamp: '2025-10-28T20:15:42Z',
      event: 'permission_check',
      operation: 'read',
      actor: 'user:alice',
      actorPrincipals: ['user:alice'],
      resource: 'ulid:01A',
      resourceTitle: 'Doc 1',
      decision: 'allow'
    });

    await logger.log({
      timestamp: '2025-10-28T20:15:43Z',
      event: 'permission_check',
      operation: 'write',
      actor: 'user:bob',
      actorPrincipals: ['user:bob'],
      resource: 'ulid:01B',
      resourceTitle: 'Doc 2',
      decision: 'deny',
      reason: 'No matching principals'
    });

    const content = await readFile(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
  });
});

describe('AuditLogger - Querying', () => {
  let logger: AuditLogger;

  beforeEach(async () => {
    logger = new AuditLogger({ bufferInMemory: true });

    // Add test entries
    await logger.log({
      timestamp: '2025-10-28T20:00:00Z',
      event: 'permission_check',
      operation: 'read',
      actor: 'user:alice',
      actorPrincipals: ['user:alice', 'team:engineering'],
      resource: 'ulid:01A',
      resourceTitle: 'Doc A',
      decision: 'allow',
      matchedPrincipal: 'user:alice'
    });

    await logger.log({
      timestamp: '2025-10-28T20:01:00Z',
      event: 'permission_check',
      operation: 'write',
      actor: 'user:alice',
      actorPrincipals: ['user:alice', 'team:engineering'],
      resource: 'ulid:01B',
      resourceTitle: 'Doc B',
      decision: 'deny',
      reason: 'No write permission'
    });

    await logger.log({
      timestamp: '2025-10-28T20:02:00Z',
      event: 'permission_check',
      operation: 'read',
      actor: 'user:bob',
      actorPrincipals: ['user:bob'],
      resource: 'ulid:01A',
      resourceTitle: 'Doc A',
      decision: 'deny',
      reason: 'No matching principals'
    });
  });

  it('should query by actor', () => {
    const results = logger.query({ actor: 'user:alice' });
    expect(results).toHaveLength(2);
    expect(results.every(e => e.actor === 'user:alice')).toBe(true);
  });

  it('should query by operation', () => {
    const results = logger.query({ operation: 'read' });
    expect(results).toHaveLength(2);
    expect(results.every(e => e.operation === 'read')).toBe(true);
  });

  it('should query by decision', () => {
    const allowResults = logger.query({ decision: 'allow' });
    const denyResults = logger.query({ decision: 'deny' });

    expect(allowResults).toHaveLength(1);
    expect(denyResults).toHaveLength(2);
  });

  it('should query by resource', () => {
    const results = logger.query({ resource: 'ulid:01A' });
    expect(results).toHaveLength(2);
  });

  it('should query by time range', () => {
    const since = new Date('2025-10-28T20:01:30Z');
    const results = logger.query({ since });

    expect(results).toHaveLength(1);
    expect(results[0].actor).toBe('user:bob');
  });

  it('should combine multiple filters', () => {
    const results = logger.query({
      actor: 'user:alice',
      decision: 'allow'
    });

    expect(results).toHaveLength(1);
    expect(results[0].operation).toBe('read');
  });
});

describe('AuditLogger - Statistics', () => {
  let logger: AuditLogger;

  beforeEach(async () => {
    logger = new AuditLogger({ bufferInMemory: true });

    // Alice: 2 allowed, 1 denied
    await logger.log({
      timestamp: '2025-10-28T20:00:00Z',
      event: 'permission_check',
      operation: 'read',
      actor: 'user:alice',
      actorPrincipals: ['user:alice'],
      resource: 'ulid:01A',
      resourceTitle: 'Doc A',
      decision: 'allow'
    });

    await logger.log({
      timestamp: '2025-10-28T20:01:00Z',
      event: 'permission_check',
      operation: 'read',
      actor: 'user:alice',
      actorPrincipals: ['user:alice'],
      resource: 'ulid:01B',
      resourceTitle: 'Doc B',
      decision: 'allow'
    });

    await logger.log({
      timestamp: '2025-10-28T20:02:00Z',
      event: 'permission_check',
      operation: 'write',
      actor: 'user:alice',
      actorPrincipals: ['user:alice'],
      resource: 'ulid:01C',
      resourceTitle: 'Doc C',
      decision: 'deny'
    });

    // Bob: 1 denied
    await logger.log({
      timestamp: '2025-10-28T20:03:00Z',
      event: 'permission_check',
      operation: 'read',
      actor: 'user:bob',
      actorPrincipals: ['user:bob'],
      resource: 'ulid:01D',
      resourceTitle: 'Doc D',
      decision: 'deny'
    });
  });

  it('should calculate overall statistics', () => {
    const stats = logger.getStatistics();

    expect(stats.total).toBe(4);
    expect(stats.allowed).toBe(2);
    expect(stats.denied).toBe(2);
  });

  it('should break down by operation', () => {
    const stats = logger.getStatistics();

    expect(stats.byOperation.read).toEqual({ allowed: 2, denied: 1 });
    expect(stats.byOperation.write).toEqual({ allowed: 0, denied: 1 });
  });

  it('should break down by actor', () => {
    const stats = logger.getStatistics();

    expect(stats.byActor['user:alice']).toEqual({ allowed: 2, denied: 1 });
    expect(stats.byActor['user:bob']).toEqual({ allowed: 0, denied: 1 });
  });
});

describe('AuditLogger - Export', () => {
  let logger: AuditLogger;

  beforeEach(async () => {
    logger = new AuditLogger({ bufferInMemory: true });

    await logger.log({
      timestamp: '2025-10-28T20:00:00Z',
      event: 'permission_check',
      operation: 'read',
      actor: 'user:alice',
      actorPrincipals: ['user:alice'],
      resource: 'ulid:01A',
      resourceTitle: 'Doc A',
      decision: 'allow',
      matchedPrincipal: 'user:alice'
    });
  });

  it('should export as JSON array', () => {
    const json = logger.exportAsJSON();
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].actor).toBe('user:alice');
  });

  it('should export as JSONL', () => {
    const jsonl = logger.exportAsJSONL();
    const lines = jsonl.trim().split('\n');

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.actor).toBe('user:alice');
  });

  it('should export as CSV', () => {
    const csv = logger.exportAsCSV();
    const lines = csv.trim().split('\n');

    expect(lines).toHaveLength(2); // Header + 1 entry
    expect(lines[0]).toContain('timestamp,event,operation');
    expect(lines[1]).toContain('user:alice');
  });

  it('should handle empty buffer in CSV export', () => {
    const emptyLogger = new AuditLogger({ bufferInMemory: true });
    const csv = emptyLogger.exportAsCSV();

    expect(csv).toContain('timestamp,event,operation');
    expect(csv.trim().split('\n')).toHaveLength(1); // Just header
  });
});

describe('AuditLogger - Buffer Management', () => {
  it('should clear buffer', async () => {
    const logger = new AuditLogger({ bufferInMemory: true });

    await logger.log({
      timestamp: '2025-10-28T20:00:00Z',
      event: 'permission_check',
      operation: 'read',
      actor: 'user:alice',
      actorPrincipals: ['user:alice'],
      resource: 'ulid:01A',
      resourceTitle: 'Doc A',
      decision: 'allow'
    });

    expect(logger.getBuffer()).toHaveLength(1);

    logger.clearBuffer();

    expect(logger.getBuffer()).toHaveLength(0);
  });

  it('should respect bufferInMemory option', async () => {
    const logger = new AuditLogger({ bufferInMemory: false });

    await logger.log({
      timestamp: '2025-10-28T20:00:00Z',
      event: 'permission_check',
      operation: 'read',
      actor: 'user:alice',
      actorPrincipals: ['user:alice'],
      resource: 'ulid:01A',
      resourceTitle: 'Doc A',
      decision: 'allow'
    });

    expect(logger.getBuffer()).toHaveLength(0);
  });

  it('should call custom onLog handler', async () => {
    const loggedEntries: any[] = [];

    const logger = new AuditLogger({
      bufferInMemory: false,
      onLog: (entry) => {
        loggedEntries.push(entry);
      }
    });

    await logger.log({
      timestamp: '2025-10-28T20:00:00Z',
      event: 'permission_check',
      operation: 'read',
      actor: 'user:alice',
      actorPrincipals: ['user:alice'],
      resource: 'ulid:01A',
      resourceTitle: 'Doc A',
      decision: 'allow'
    });

    expect(loggedEntries).toHaveLength(1);
    expect(loggedEntries[0].actor).toBe('user:alice');
  });
});
