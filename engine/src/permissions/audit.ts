/**
 * Audit Logger
 * Records permission checks for compliance and debugging
 *
 * Spec: specs/02-permission-checks.md - Example 15
 * Tests: src/permissions/audit.test.ts
 *
 * Every permission check is logged with actor, resource, and decision.
 * Logs can be written to file (JSONL format) or sent to external system.
 */

import { writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import type { PermissionAuditEntry } from '../types/principal.js';

export interface AuditLoggerOptions {
  /**
   * Path to audit log file (JSONL format)
   * If not provided, logs to memory only
   */
  logPath?: string;

  /**
   * Whether to also log to console
   */
  console?: boolean;

  /**
   * Custom log handler (e.g., send to external service)
   */
  onLog?: (entry: PermissionAuditEntry) => void | Promise<void>;

  /**
   * Whether to buffer logs in memory
   * Useful for testing or analysis
   */
  bufferInMemory?: boolean;
}

export class AuditLogger {
  private buffer: PermissionAuditEntry[] = [];
  private options: AuditLoggerOptions;

  constructor(options: AuditLoggerOptions = {}) {
    this.options = {
      console: false,
      bufferInMemory: true,
      ...options
    };
  }

  /**
   * Log a permission check event
   */
  async log(entry: PermissionAuditEntry): Promise<void> {
    // Add to memory buffer if enabled
    if (this.options.bufferInMemory) {
      this.buffer.push(entry);
    }

    // Log to console if enabled
    if (this.options.console) {
      console.log('[AUDIT]', JSON.stringify(entry));
    }

    // Write to file if path provided
    if (this.options.logPath) {
      await this.writeToFile(entry);
    }

    // Call custom handler if provided
    if (this.options.onLog) {
      await this.options.onLog(entry);
    }
  }

  /**
   * Create audit entry from permission check
   * Helper to simplify audit logging in permission checker
   */
  createEntry(params: {
    actor: string;
    actorPrincipals: string[];
    operation: PermissionAuditEntry['operation'];
    resource: string;
    resourceTitle: string;
    decision: 'allow' | 'deny';
    matchedPrincipal?: string;
    reason?: string;
  }): PermissionAuditEntry {
    return {
      timestamp: new Date().toISOString(),
      event: 'permission_check',
      operation: params.operation,
      actor: params.actor,
      actorPrincipals: params.actorPrincipals as any,
      resource: params.resource,
      resourceTitle: params.resourceTitle,
      decision: params.decision,
      matchedPrincipal: params.matchedPrincipal as any,
      reason: params.reason
    };
  }

  /**
   * Get all buffered entries
   * Only available if bufferInMemory is true
   */
  getBuffer(): PermissionAuditEntry[] {
    return [...this.buffer];
  }

  /**
   * Get buffered entries filtered by criteria
   */
  query(filter: {
    actor?: string;
    operation?: PermissionAuditEntry['operation'];
    decision?: 'allow' | 'deny';
    resource?: string;
    since?: Date;
  }): PermissionAuditEntry[] {
    let results = this.buffer;

    if (filter.actor) {
      results = results.filter(e => e.actor === filter.actor);
    }

    if (filter.operation) {
      results = results.filter(e => e.operation === filter.operation);
    }

    if (filter.decision) {
      results = results.filter(e => e.decision === filter.decision);
    }

    if (filter.resource) {
      results = results.filter(e => e.resource === filter.resource);
    }

    if (filter.since) {
      const sinceTime = filter.since.getTime();
      results = results.filter(e => new Date(e.timestamp).getTime() >= sinceTime);
    }

    return results;
  }

  /**
   * Get audit statistics
   */
  getStatistics(): {
    total: number;
    allowed: number;
    denied: number;
    byOperation: Record<string, { allowed: number; denied: number }>;
    byActor: Record<string, { allowed: number; denied: number }>;
  } {
    const stats = {
      total: this.buffer.length,
      allowed: 0,
      denied: 0,
      byOperation: {} as Record<string, { allowed: number; denied: number }>,
      byActor: {} as Record<string, { allowed: number; denied: number }>
    };

    for (const entry of this.buffer) {
      // Overall counts
      if (entry.decision === 'allow') {
        stats.allowed++;
      } else {
        stats.denied++;
      }

      // By operation
      if (!stats.byOperation[entry.operation]) {
        stats.byOperation[entry.operation] = { allowed: 0, denied: 0 };
      }
      stats.byOperation[entry.operation][entry.decision === 'allow' ? 'allowed' : 'denied']++;

      // By actor
      if (!stats.byActor[entry.actor]) {
        stats.byActor[entry.actor] = { allowed: 0, denied: 0 };
      }
      stats.byActor[entry.actor][entry.decision === 'allow' ? 'allowed' : 'denied']++;
    }

    return stats;
  }

  /**
   * Clear the memory buffer
   */
  clearBuffer(): void {
    this.buffer = [];
  }

  /**
   * Write audit entry to file (JSONL format)
   */
  private async writeToFile(entry: PermissionAuditEntry): Promise<void> {
    if (!this.options.logPath) return;

    try {
      // Ensure directory exists
      const dir = dirname(this.options.logPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      // Append to file as JSONL (one JSON object per line)
      const line = JSON.stringify(entry) + '\n';

      // Check if file exists
      if (existsSync(this.options.logPath)) {
        await appendFile(this.options.logPath, line, 'utf-8');
      } else {
        await writeFile(this.options.logPath, line, 'utf-8');
      }
    } catch (error) {
      // Log to console if file write fails
      console.error('Failed to write audit log:', error);
      console.log('[AUDIT FALLBACK]', JSON.stringify(entry));
    }
  }

  /**
   * Export audit log as JSON array
   */
  exportAsJSON(): string {
    return JSON.stringify(this.buffer, null, 2);
  }

  /**
   * Export audit log as JSONL (one entry per line)
   */
  exportAsJSONL(): string {
    return this.buffer.map(entry => JSON.stringify(entry)).join('\n');
  }

  /**
   * Export audit log as CSV
   */
  exportAsCSV(): string {
    if (this.buffer.length === 0) {
      return 'timestamp,event,operation,actor,resource,resourceTitle,decision,matchedPrincipal,reason\n';
    }

    const header = 'timestamp,event,operation,actor,resource,resourceTitle,decision,matchedPrincipal,reason\n';

    const rows = this.buffer.map(entry => {
      const fields = [
        entry.timestamp,
        entry.event,
        entry.operation,
        entry.actor,
        entry.resource,
        entry.resourceTitle,
        entry.decision,
        entry.matchedPrincipal || '',
        entry.reason || ''
      ];

      // Escape CSV values
      return fields.map(f => {
        const str = String(f);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',');
    });

    return header + rows.join('\n');
  }
}
