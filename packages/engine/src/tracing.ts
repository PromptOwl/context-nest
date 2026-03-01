/**
 * Audit trace logging (§9.2, §9.3).
 */

import type { AccessTrace, SourceHydrationTrace, TraceEntry } from "./types.js";

export class TraceLogger {
  private traces: TraceEntry[] = [];

  /** Log a document access event (§9.2) */
  logAccess(params: {
    documentRef: string;
    documentVersion: number;
    checkpoint: number;
    author?: string;
    editedAt?: string;
  }): AccessTrace {
    const trace: AccessTrace = {
      trace_type: "access",
      document_ref: params.documentRef,
      document_version: params.documentVersion,
      checkpoint: params.checkpoint,
      author: params.author,
      edited_at: params.editedAt,
      accessed_at: new Date().toISOString(),
    };
    this.traces.push(trace);
    return trace;
  }

  /** Log a source hydration event (§9.3) */
  logSourceHydration(params: {
    sourceRef: string;
    sourceVersion: number;
    checkpoint: number;
    toolsCalled: string[];
    server?: string;
    resultHash?: string;
    resultSize?: number;
    cacheHit: boolean;
    durationMs?: number;
    error?: string;
  }): SourceHydrationTrace {
    let traceType: SourceHydrationTrace["trace_type"];
    if (params.error) {
      traceType = "source_failure";
    } else if (params.cacheHit) {
      traceType = "source_cache_hit";
    } else {
      traceType = "source_hydration";
    }

    const trace: SourceHydrationTrace = {
      trace_type: traceType,
      source_ref: params.sourceRef,
      source_version: params.sourceVersion,
      checkpoint: params.checkpoint,
      tools_called: params.toolsCalled,
      server: params.server,
      result_hash: params.resultHash,
      result_size: params.resultSize,
      cache_hit: params.cacheHit,
      duration_ms: params.durationMs,
      error: params.error,
    };
    this.traces.push(trace);
    return trace;
  }

  /** Get all trace entries */
  getTraces(): TraceEntry[] {
    return [...this.traces];
  }

  /** Clear all traces */
  clear(): void {
    this.traces = [];
  }
}
