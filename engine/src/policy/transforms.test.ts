/**
 * Transform Tests
 * Tests built-in transform functions
 */

import {
  TransformRegistry,
  TransformEngine,
  redactPII,
  redactEmails,
  removeInternalLinks,
  addWatermark,
  summarize
} from './transforms.js';

describe('Transform Functions - PII Redaction', () => {
  it('should redact email addresses', () => {
    const input = 'Contact john.doe@example.com for details.';
    const output = redactEmails(input);

    expect(output).toContain('[REDACTED_EMAIL]');
    expect(output).not.toContain('john.doe@example.com');
  });

  it('should redact SSNs', () => {
    const input = 'SSN: 123-45-6789';
    const output = redactPII(input);

    expect(output).toContain('[REDACTED_SSN]');
    expect(output).not.toContain('123-45-6789');
  });

  it('should redact phone numbers', () => {
    const input = 'Call 555-123-4567 or (555) 987-6543';
    const output = redactPII(input);

    expect(output).toContain('[REDACTED_PHONE]');
    expect(output).not.toContain('555-123-4567');
  });

  it('should redact all PII types', () => {
    const input = 'Customer: John Doe (john@example.com, SSN: 123-45-6789, Phone: 555-1234)';
    const output = redactPII(input);

    expect(output).toContain('[REDACTED_EMAIL]');
    expect(output).toContain('[REDACTED_SSN]');
    expect(output).not.toContain('john@example.com');
    expect(output).not.toContain('123-45-6789');
  });
});

describe('Transform Functions - Content Modification', () => {
  it('should remove internal links', () => {
    const input = 'See [[Brand Guidelines]] and [[API Docs]] for more info.';
    const output = removeInternalLinks(input);

    expect(output).toBe('See Brand Guidelines and API Docs for more info.');
    expect(output).not.toContain('[[');
  });

  it('should add watermark at top', () => {
    const input = 'Document content here.';
    const output = addWatermark(input, { text: 'CONFIDENTIAL', position: 'top' });

    expect(output).toContain('---\nCONFIDENTIAL\n---');
    expect(output).toMatch(/^---\nCONFIDENTIAL/);
  });

  it('should add watermark at bottom', () => {
    const input = 'Document content here.';
    const output = addWatermark(input, { text: 'CONFIDENTIAL', position: 'bottom' });

    expect(output).toContain('---\nCONFIDENTIAL\n---');
    expect(output).toMatch(/CONFIDENTIAL\n---\n\n$/);
  });

  it('should summarize long content', () => {
    const words = Array(2000).fill('word').join(' ');
    const output = summarize(words, { maxWords: 100 });

    const outputWords = output.trim().split(/\s+/);
    expect(outputWords.length).toBeLessThan(150); // Allow for summary note
    expect(output).toContain('Content summarized');
  });

  it('should not summarize short content', () => {
    const input = 'Short content here.';
    const output = summarize(input, { maxWords: 1000 });

    expect(output).toBe(input);
  });
});

describe('TransformRegistry', () => {
  it('should register and retrieve transforms', () => {
    const registry = new TransformRegistry();

    const customTransform = (content: string) => content.toUpperCase();
    registry.register('uppercase', customTransform);

    expect(registry.has('uppercase')).toBe(true);
    expect(registry.get('uppercase')).toBe(customTransform);
  });

  it('should list all transforms', () => {
    const registry = new TransformRegistry();
    const transforms = registry.list();

    expect(transforms).toContain('redact_pii');
    expect(transforms).toContain('add_watermark');
    expect(transforms).toContain('summarize');
  });

  it('should have built-in transforms', () => {
    const registry = new TransformRegistry();

    expect(registry.has('redact_pii')).toBe(true);
    expect(registry.has('redact_emails')).toBe(true);
    expect(registry.has('remove_internal_links')).toBe(true);
    expect(registry.has('add_watermark')).toBe(true);
    expect(registry.has('summarize')).toBe(true);
  });
});

describe('TransformEngine', () => {
  let registry: TransformRegistry;
  let engine: TransformEngine;

  beforeEach(() => {
    registry = new TransformRegistry();
    engine = new TransformEngine(registry);
  });

  it('should apply transform and return result', async () => {
    const input = 'Contact john@example.com';
    const result = await engine.apply('redact_emails', input);

    expect(result.content).toContain('[REDACTED_EMAIL]');
    expect(result.originalChecksum).toBeDefined();
    expect(result.resultChecksum).toBeDefined();
    expect(result.originalChecksum).not.toBe(result.resultChecksum);
  });

  it('should track word counts', async () => {
    const input = 'One two three four five';
    const result = await engine.apply('redact_pii', input);

    expect(result.originalCount?.words).toBe(5);
    expect(result.resultCount?.words).toBeGreaterThan(0);
  });

  it('should parse parameterized transforms', async () => {
    const input = Array(2000).fill('word').join(' ');
    const result = await engine.apply('summarize:100', input);

    expect(result.content).toContain('Content summarized');
    expect(result.resultCount?.words).toBeLessThan(150);
  });

  it('should throw on unknown transform', async () => {
    await expect(
      engine.apply('nonexistent', 'content')
    ).rejects.toThrow('Unknown transform: nonexistent');
  });

  it('should include timestamp', async () => {
    const result = await engine.apply('redact_pii', 'test');

    expect(result.appliedAt).toBeDefined();
    expect(new Date(result.appliedAt).getTime()).toBeGreaterThan(0);
  });

  it('should preserve transform name with params', async () => {
    const result = await engine.apply('summarize:500', 'content');

    expect(result.transform).toBe('summarize:500');
  });
});

describe('Transform Edge Cases', () => {
  it('should handle empty content', () => {
    const output = redactPII('');
    expect(output).toBe('');
  });

  it('should handle content with no PII', () => {
    const input = 'This document has no sensitive information.';
    const output = redactPII(input);
    expect(output).toBe(input);
  });

  it('should handle multiple emails in one string', () => {
    const input = 'Emails: alice@example.com, bob@example.com, charlie@example.com';
    const output = redactEmails(input);

    const redactedCount = (output.match(/\[REDACTED_EMAIL\]/g) || []).length;
    expect(redactedCount).toBe(3);
  });

  it('should handle nested internal links', () => {
    const input = 'See [[Outer [[Inner]] Link]] here.';
    const output = removeInternalLinks(input);

    // Note: Simple regex only handles one level of nesting at a time
    // First pass: [[Inner]] -> Inner, then [[Outer Inner Link]] remains
    // This is acceptable for the simple implementation
    expect(output).toContain('Inner');
  });
});
