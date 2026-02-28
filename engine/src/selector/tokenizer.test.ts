/**
 * Selector Tokenizer Tests
 * Driven by: specs/01-selector-grammar.md
 *
 * The tokenizer breaks selector strings into tokens for parsing.
 * Tests cover all selector patterns from the spec.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Tokenizer, type Token, TokenType } from './tokenizer.js';
import type { SyntaxConfig } from '../types/index.js';

describe('Tokenizer - Basic Tokens', () => {
  let tokenizer: Tokenizer;

  beforeEach(() => {
    tokenizer = new Tokenizer();
  });

  // Spec 01 - Example 1: Select by tag
  it('should tokenize simple tag selector', () => {
    const tokens = tokenizer.tokenize('#onboarding');

    expect(tokens).toEqual([
      { type: TokenType.TAG, value: 'onboarding', raw: '#onboarding', position: 0 },
    ]);
  });

  // Spec 01 - Example 2: Title transclusion
  it('should tokenize title transclusion', () => {
    const tokens = tokenizer.tokenize('[[Brand One-Pager]]');

    expect(tokens).toEqual([
      { type: TokenType.TITLE, value: 'Brand One-Pager', raw: '[[Brand One-Pager]]', position: 0 },
    ]);
  });

  // Spec 01 - Example 5: Owner scoping
  it('should tokenize owner-scoped title', () => {
    const tokens = tokenizer.tokenize('@legal/Contract Template');

    expect(tokens).toEqual([
      {
        type: TokenType.OWNER_TITLE,
        value: { owner: 'legal', title: 'Contract Template' },
        raw: '@legal/Contract Template',
        position: 0,
      },
    ]);
  });

  // Spec 01 - Example 7: Pack reference
  it('should tokenize pack reference', () => {
    const tokens = tokenizer.tokenize('pack:onboarding.basics');

    expect(tokens).toEqual([
      { type: TokenType.PACK, value: 'onboarding.basics', raw: 'pack:onboarding.basics', position: 0 },
    ]);
  });
});

describe('Tokenizer - Filters', () => {
  let tokenizer: Tokenizer;

  beforeEach(() => {
    tokenizer = new Tokenizer();
  });

  // Spec 01 - Example 6: Type filtering
  it('should tokenize type filter', () => {
    const tokens = tokenizer.tokenize('type:glossary');

    expect(tokens).toEqual([
      { type: TokenType.FILTER, value: { key: 'type', value: 'glossary' }, raw: 'type:glossary', position: 0 },
    ]);
  });

  // Spec 01 - Example 9: Date filtering
  it('should tokenize date filter', () => {
    const tokens = tokenizer.tokenize('before:2025-06-01');

    expect(tokens).toEqual([
      {
        type: TokenType.FILTER,
        value: { key: 'before', value: '2025-06-01' },
        raw: 'before:2025-06-01',
        position: 0,
      },
    ]);
  });

  // Spec 01 - Example 10: Scope filtering
  it('should tokenize scope filter', () => {
    const tokens = tokenizer.tokenize('scope:team');

    expect(tokens).toEqual([
      { type: TokenType.FILTER, value: { key: 'scope', value: 'team' }, raw: 'scope:team', position: 0 },
    ]);
  });
});

describe('Tokenizer - Composition Operators', () => {
  let tokenizer: Tokenizer;

  beforeEach(() => {
    tokenizer = new Tokenizer();
  });

  // Spec 01 - Example 3: AND operator
  it('should tokenize AND operator (+)', () => {
    const tokens = tokenizer.tokenize('#onboarding + #external');

    expect(tokens).toEqual([
      { type: TokenType.TAG, value: 'onboarding', raw: '#onboarding', position: 0 },
      { type: TokenType.AND, value: '+', raw: '+', position: 12 },
      { type: TokenType.TAG, value: 'external', raw: '#external', position: 14 },
    ]);
  });

  // Spec 01 - Example 4: NOT operator
  it('should tokenize NOT operator (-)', () => {
    const tokens = tokenizer.tokenize('#guide - #deprecated');

    expect(tokens).toEqual([
      { type: TokenType.TAG, value: 'guide', raw: '#guide', position: 0 },
      { type: TokenType.NOT, value: '-', raw: '-', position: 7 },
      { type: TokenType.TAG, value: 'deprecated', raw: '#deprecated', position: 9 },
    ]);
  });

  // Spec 01: OR operator (from Example 14)
  it('should tokenize OR operator (|)', () => {
    const tokens = tokenizer.tokenize('#onboarding | #brand');

    expect(tokens).toEqual([
      { type: TokenType.TAG, value: 'onboarding', raw: '#onboarding', position: 0 },
      { type: TokenType.OR, value: '|', raw: '|', position: 12 },
      { type: TokenType.TAG, value: 'brand', raw: '#brand', position: 14 },
    ]);
  });
});

describe('Tokenizer - Complex Selectors', () => {
  let tokenizer: Tokenizer;

  beforeEach(() => {
    tokenizer = new Tokenizer();
  });

  // Spec 01 - Example 8: Complex composition
  it('should tokenize complex selector with multiple operators', () => {
    const tokens = tokenizer.tokenize('pack:onboarding.basics + [[Brand One-Pager]] - #deprecated');

    expect(tokens).toEqual([
      { type: TokenType.PACK, value: 'onboarding.basics', raw: 'pack:onboarding.basics', position: 0 },
      { type: TokenType.AND, value: '+', raw: '+', position: 23 },
      { type: TokenType.TITLE, value: 'Brand One-Pager', raw: '[[Brand One-Pager]]', position: 25 },
      { type: TokenType.NOT, value: '-', raw: '-', position: 45 },
      { type: TokenType.TAG, value: 'deprecated', raw: '#deprecated', position: 47 },
    ]);
  });

  // Spec 01 - Example 6: Multiple filters
  it('should tokenize selector with tag and filters', () => {
    const tokens = tokenizer.tokenize('#product type:glossary');

    expect(tokens).toEqual([
      { type: TokenType.TAG, value: 'product', raw: '#product', position: 0 },
      { type: TokenType.FILTER, value: { key: 'type', value: 'glossary' }, raw: 'type:glossary', position: 9 },
    ]);
  });

  // Spec 01 - Example 15: Parentheses for precedence
  it('should tokenize parentheses', () => {
    const tokens = tokenizer.tokenize('(#onboarding | #brand) + #public');

    expect(tokens).toEqual([
      { type: TokenType.LPAREN, value: '(', raw: '(', position: 0 },
      { type: TokenType.TAG, value: 'onboarding', raw: '#onboarding', position: 1 },
      { type: TokenType.OR, value: '|', raw: '|', position: 13 },
      { type: TokenType.TAG, value: 'brand', raw: '#brand', position: 15 },
      { type: TokenType.RPAREN, value: ')', raw: ')', position: 21 },
      { type: TokenType.AND, value: '+', raw: '+', position: 23 },
      { type: TokenType.TAG, value: 'public', raw: '#public', position: 25 },
    ]);
  });
});

describe('Tokenizer - Whitespace Handling', () => {
  let tokenizer: Tokenizer;

  beforeEach(() => {
    tokenizer = new Tokenizer();
  });

  it('should handle leading/trailing whitespace', () => {
    const tokens = tokenizer.tokenize('  #onboarding  ');

    expect(tokens).toEqual([
      { type: TokenType.TAG, value: 'onboarding', raw: '#onboarding', position: 0 },
    ]);
  });

  it('should handle multiple spaces between tokens', () => {
    const tokens = tokenizer.tokenize('#onboarding    +    #external');

    expect(tokens).toEqual([
      { type: TokenType.TAG, value: 'onboarding', raw: '#onboarding', position: 0 },
      { type: TokenType.AND, value: '+', raw: '+', position: 15 },
      { type: TokenType.TAG, value: 'external', raw: '#external', position: 20 },
    ]);
  });

  it('should preserve spaces in titles', () => {
    const tokens = tokenizer.tokenize('[[Brand   Guidelines]]');

    expect(tokens).toEqual([
      { type: TokenType.TITLE, value: 'Brand   Guidelines', raw: '[[Brand   Guidelines]]', position: 0 },
    ]);
  });
});

describe('Tokenizer - Edge Cases', () => {
  let tokenizer: Tokenizer;

  beforeEach(() => {
    tokenizer = new Tokenizer();
  });

  it('should handle empty string', () => {
    const tokens = tokenizer.tokenize('');
    expect(tokens).toEqual([]);
  });

  it('should handle only whitespace', () => {
    const tokens = tokenizer.tokenize('   ');
    expect(tokens).toEqual([]);
  });

  it('should handle unclosed title transclusion', () => {
    expect(() => {
      tokenizer.tokenize('[[Unclosed');
    }).toThrow('Unclosed title transclusion');
  });

  it('should handle tag with hyphen', () => {
    const tokens = tokenizer.tokenize('#multi-word-tag');

    expect(tokens).toEqual([
      { type: TokenType.TAG, value: 'multi-word-tag', raw: '#multi-word-tag', position: 0 },
    ]);
  });

  it('should handle tag with underscore', () => {
    const tokens = tokenizer.tokenize('#snake_case_tag');

    expect(tokens).toEqual([
      { type: TokenType.TAG, value: 'snake_case_tag', raw: '#snake_case_tag', position: 0 },
    ]);
  });

  it('should handle pack ID with dots', () => {
    const tokens = tokenizer.tokenize('pack:engineering.internal.docs');

    expect(tokens).toEqual([
      {
        type: TokenType.PACK,
        value: 'engineering.internal.docs',
        raw: 'pack:engineering.internal.docs',
        position: 0,
      },
    ]);
  });

  it('should handle owner with hyphen and underscore', () => {
    const tokens = tokenizer.tokenize('@team-name_123/Document');

    expect(tokens).toEqual([
      {
        type: TokenType.OWNER_TITLE,
        value: { owner: 'team-name_123', title: 'Document' },
        raw: '@team-name_123/Document',
        position: 0,
      },
    ]);
  });
});

describe('Tokenizer - Custom Syntax', () => {
  it('should use custom syntax configuration - Owlpad style', () => {
    const customSyntax: SyntaxConfig = {
      tokens: {
        title_transclusion: '<<{{title}}>>',
        tag: '@{{tag}}',
        owner_scope: '~{{owner}}/{{title}}',
        pack_reference: 'bundle:{{pack_id}}',
      },
    };

    const tokenizer = new Tokenizer(customSyntax);

    // Test custom title syntax
    const titleTokens = tokenizer.tokenize('<<Brand Guide>>');
    expect(titleTokens).toEqual([
      { type: TokenType.TITLE, value: 'Brand Guide', raw: '<<Brand Guide>>', position: 0 },
    ]);

    // Test custom tag syntax
    const tagTokens = tokenizer.tokenize('@onboarding');
    expect(tagTokens).toEqual([
      { type: TokenType.TAG, value: 'onboarding', raw: '@onboarding', position: 0 },
    ]);

    // Test custom owner syntax
    const ownerTokens = tokenizer.tokenize('~legal/Contract');
    expect(ownerTokens).toEqual([
      {
        type: TokenType.OWNER_TITLE,
        value: { owner: 'legal', title: 'Contract' },
        raw: '~legal/Contract',
        position: 0,
      },
    ]);

    // Test custom pack syntax
    const packTokens = tokenizer.tokenize('bundle:onboarding.basics');
    expect(packTokens).toEqual([
      {
        type: TokenType.PACK,
        value: 'onboarding.basics',
        raw: 'bundle:onboarding.basics',
        position: 0,
      },
    ]);
  });

  it('should handle mixed custom and standard operators', () => {
    const customSyntax: SyntaxConfig = {
      tokens: {
        title_transclusion: '<<{{title}}>>',
        tag: '~{{tag}}',
        owner_scope: '%{{owner}}/{{title}}',
        pack_reference: '${{pack_id}}',
      },
    };

    const tokenizer = new Tokenizer(customSyntax);
    const tokens = tokenizer.tokenize('~onboarding | ~brand');

    expect(tokens).toEqual([
      { type: TokenType.TAG, value: 'onboarding', raw: '~onboarding', position: 0 },
      { type: TokenType.OR, value: '|', raw: '|', position: 12 },
      { type: TokenType.TAG, value: 'brand', raw: '~brand', position: 14 },
    ]);
  });
});

describe('Tokenizer - Error Messages', () => {
  let tokenizer: Tokenizer;

  beforeEach(() => {
    tokenizer = new Tokenizer();
  });

  it('should provide helpful error for unclosed brackets', () => {
    expect(() => {
      tokenizer.tokenize('[[Missing close bracket');
    }).toThrow(/Unclosed title transclusion.*position/);
  });

  it('should provide helpful error for invalid characters', () => {
    expect(() => {
      tokenizer.tokenize('#tag! invalid');
    }).toThrow(/Unexpected character.*position/);
  });

  it('should include position in error messages', () => {
    try {
      tokenizer.tokenize('#tag + [[unclosed');
      fail('Should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('position');
      expect(error.position).toBeGreaterThan(0);
    }
  });
});
