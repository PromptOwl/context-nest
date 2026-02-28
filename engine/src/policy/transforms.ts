/**
 * Transform Registry and Built-in Transforms
 * Manages content transformation functions
 *
 * Spec: specs/03-policy-transforms.md
 * Tests: src/policy/transforms.test.ts
 *
 * Provides registry for transform functions and implements common transforms.
 */

import { createHash } from 'crypto';
import type { TransformFunction, TransformResult } from '../types/policy.js';

/**
 * Transform Registry
 * Manages available transform functions
 */
export class TransformRegistry {
  private transforms = new Map<string, TransformFunction>();

  constructor() {
    // Register built-in transforms
    this.registerBuiltins();
  }

  /**
   * Register a transform function
   */
  register(name: string, fn: TransformFunction): void {
    this.transforms.set(name, fn);
  }

  /**
   * Get a transform function by name
   */
  get(name: string): TransformFunction | undefined {
    return this.transforms.get(name);
  }

  /**
   * Check if transform exists
   */
  has(name: string): boolean {
    return this.transforms.has(name);
  }

  /**
   * List all available transforms
   */
  list(): string[] {
    return Array.from(this.transforms.keys());
  }

  /**
   * Register all built-in transforms
   */
  private registerBuiltins(): void {
    this.register('redact_pii', redactPII);
    this.register('redact_emails', redactEmails);
    this.register('redact_ssn', redactSSN);
    this.register('remove_internal_links', removeInternalLinks);
    this.register('add_watermark', addWatermark);
    this.register('add_disclaimer', addDisclaimer);
    this.register('add_warning', addWarning);
    this.register('summarize', summarize);
  }
}

/**
 * Transform Engine
 * Applies transforms and tracks results
 */
export class TransformEngine {
  constructor(private registry: TransformRegistry) {}

  /**
   * Apply a transform to content
   * Returns transformed content with metadata
   */
  async apply(
    transform: string,
    content: string,
    params?: Record<string, any>
  ): Promise<TransformResult> {
    // Parse transform name and inline params
    const { name, transformParams } = this.parseTransform(transform);

    // Merge inline params with explicit params
    const allParams = { ...transformParams, ...params };

    // Get transform function
    const fn = this.registry.get(name);
    if (!fn) {
      throw new Error(`Unknown transform: ${name}`);
    }

    // Calculate original checksums and counts
    const originalChecksum = this.checksum(content);
    const originalCount = this.countWords(content);

    // Apply transform
    const transformedContent = await fn(content, allParams);

    // Calculate result checksums and counts
    const resultChecksum = this.checksum(transformedContent);
    const resultCount = this.countWords(transformedContent);

    return {
      content: transformedContent,
      originalChecksum,
      resultChecksum,
      appliedAt: new Date().toISOString(),
      transform: transform,
      originalCount: { words: originalCount },
      resultCount: { words: resultCount }
    };
  }

  /**
   * Parse transform string to extract name and params
   * Examples:
   * - "redact_pii" → { name: "redact_pii", params: {} }
   * - "summarize:1000" → { name: "summarize", params: { maxWords: 1000 } }
   */
  private parseTransform(transform: string): {
    name: string;
    transformParams: Record<string, any>;
  } {
    const parts = transform.split(':');
    const name = parts[0];
    const transformParams: Record<string, any> = {};

    if (parts.length > 1) {
      // Handle parameterized transforms
      if (name === 'summarize') {
        transformParams.maxWords = parseInt(parts[1], 10);
      } else {
        transformParams.param = parts[1];
      }
    }

    return { name, transformParams };
  }

  /**
   * Calculate SHA-256 checksum of content
   */
  private checksum(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Count words in content
   */
  private countWords(content: string): number {
    return content.trim().split(/\s+/).filter(w => w.length > 0).length;
  }
}

// ============================================================================
// Built-in Transform Functions
// ============================================================================

/**
 * Redact PII (Personally Identifiable Information)
 * Removes emails, SSNs, phone numbers, and common PII patterns
 */
export function redactPII(content: string, params?: Record<string, any>): string {
  let result = content;

  // Redact emails
  result = result.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');

  // Redact SSNs (XXX-XX-XXXX)
  result = result.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');

  // Redact phone numbers (various formats)
  result = result.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[REDACTED_PHONE]');
  result = result.replace(/\(\d{3}\)\s*\d{3}[-.]?\d{4}\b/g, '[REDACTED_PHONE]');

  // Redact credit cards (simplified)
  result = result.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[REDACTED_CC]');

  // Redact potential names (capitalized words preceded by common titles)
  const namePattern = /\b(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  result = result.replace(namePattern, '$1 [REDACTED_NAME]');

  return result;
}

/**
 * Redact email addresses only
 */
export function redactEmails(content: string, params?: Record<string, any>): string {
  return content.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    '[REDACTED_EMAIL]'
  );
}

/**
 * Redact Social Security Numbers
 */
export function redactSSN(content: string, params?: Record<string, any>): string {
  return content.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
}

/**
 * Remove internal wiki-style links [[link]]
 */
export function removeInternalLinks(content: string, params?: Record<string, any>): string {
  // Remove [[Link]] style links, keeping just the text
  return content.replace(/\[\[([^\]]+)\]\]/g, '$1');
}

/**
 * Add watermark to content
 */
export function addWatermark(content: string, params?: Record<string, any>): string {
  const text = params?.text || 'CONFIDENTIAL - DO NOT DISTRIBUTE';
  const position = params?.position || 'top'; // 'top' or 'bottom'

  const watermark = `---\n${text}\n---\n\n`;

  if (position === 'bottom') {
    return content + '\n\n' + watermark;
  }

  return watermark + content;
}

/**
 * Add disclaimer to content
 */
export function addDisclaimer(content: string, params?: Record<string, any>): string {
  const text = params?.text || 'This document is provided for informational purposes only.';

  const disclaimer = `\n\n---\n**Disclaimer**: ${text}\n`;

  return content + disclaimer;
}

/**
 * Add warning message to content
 */
export function addWarning(content: string, params?: Record<string, any>): string {
  const message = params?.message || '⚠️ Warning: This content may be outdated.';

  return `${message}\n\n${content}`;
}

/**
 * Summarize content to target word count
 * Simple implementation - takes first N words
 * In production, would use LLM for intelligent summarization
 */
export function summarize(content: string, params?: Record<string, any>): string {
  const maxWords = params?.maxWords || 1000;

  // Remove markdown headers for cleaner summarization
  const cleaned = content.replace(/^#+\s+/gm, '');

  // Split into words
  const words = cleaned.trim().split(/\s+/);

  if (words.length <= maxWords) {
    return content; // Already short enough
  }

  // Take first maxWords words
  const truncated = words.slice(0, maxWords).join(' ');

  // Add ellipsis and summary note
  return `${truncated}...\n\n*[Content summarized from ${words.length} to ${maxWords} words]*`;
}
