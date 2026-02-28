/**
 * Parser Tests
 * Spec: specs/01-selector-grammar.md
 * Feature: features/01-selector-resolution.feature
 *
 * Tests token stream → AST conversion
 */

import { Parser, ParserError } from './parser.js';
import { TokenType, Token } from './tokenizer.js';
import type { ASTNode, TagNode, TitleNode, AndNode, OrNode, NotNode, FilterNode, OwnerTitleNode, PackNode } from './ast.js';

describe('Parser - Single Tokens', () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
  });

  // Spec 01 - Example 1: Single tag
  it('should parse single tag token', () => {
    const tokens: Token[] = [
      { type: TokenType.TAG, value: 'onboarding', raw: '#onboarding', position: 0 },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<TagNode>({
      type: 'TAG',
      value: 'onboarding',
    });
  });

  // Spec 01 - Example 2: Title transclusion
  it('should parse single title token', () => {
    const tokens: Token[] = [
      { type: TokenType.TITLE, value: 'Brand Guidelines', raw: '[[Brand Guidelines]]', position: 0 },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<TitleNode>({
      type: 'TITLE',
      value: 'Brand Guidelines',
    });
  });

  // Spec 01 - Example 5: Owner-scoped title
  it('should parse owner-scoped title token', () => {
    const tokens: Token[] = [
      {
        type: TokenType.OWNER_TITLE,
        value: { owner: 'legal', title: 'Contract Template' },
        raw: '@legal/Contract Template',
        position: 0,
      },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<OwnerTitleNode>({
      type: 'OWNER_TITLE',
      owner: 'legal',
      title: 'Contract Template',
    });
  });

  // Spec 01 - Example 6: Type filter
  it('should parse filter token', () => {
    const tokens: Token[] = [
      { type: TokenType.FILTER, value: { key: 'type', value: 'glossary' }, raw: 'type:glossary', position: 0 },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<FilterNode>({
      type: 'FILTER',
      key: 'type',
      value: 'glossary',
    });
  });

  // Spec 01 - Example 7: Pack reference
  it('should parse pack token', () => {
    const tokens: Token[] = [
      { type: TokenType.PACK, value: 'onboarding.basics', raw: 'pack:onboarding.basics', position: 0 },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<PackNode>({
      type: 'PACK',
      value: 'onboarding.basics',
    });
  });
});

describe('Parser - Binary Operations', () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
  });

  // Spec 01 - Example 3: AND composition
  it('should parse AND composition', () => {
    const tokens: Token[] = [
      { type: TokenType.TAG, value: 'onboarding', raw: '#onboarding', position: 0 },
      { type: TokenType.AND, value: '+', raw: '+', position: 12 },
      { type: TokenType.TAG, value: 'external', raw: '#external', position: 14 },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<AndNode>({
      type: 'AND',
      left: { type: 'TAG', value: 'onboarding' },
      right: { type: 'TAG', value: 'external' },
    });
  });

  // Spec 01 - Example 4: NOT composition (exclusion)
  it('should parse NOT composition', () => {
    const tokens: Token[] = [
      { type: TokenType.TAG, value: 'guide', raw: '#guide', position: 0 },
      { type: TokenType.NOT, value: '-', raw: '-', position: 7 },
      { type: TokenType.TAG, value: 'deprecated', raw: '#deprecated', position: 9 },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<NotNode>({
      type: 'NOT',
      left: { type: 'TAG', value: 'guide' },
      right: { type: 'TAG', value: 'deprecated' },
    });
  });

  // OR composition
  it('should parse OR composition', () => {
    const tokens: Token[] = [
      { type: TokenType.TAG, value: 'guide', raw: '#guide', position: 0 },
      { type: TokenType.OR, value: '|', raw: '|', position: 7 },
      { type: TokenType.TAG, value: 'tutorial', raw: '#tutorial', position: 9 },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<OrNode>({
      type: 'OR',
      left: { type: 'TAG', value: 'guide' },
      right: { type: 'TAG', value: 'tutorial' },
    });
  });

  // Spec 01 - Example 6: Filter with tag
  it('should parse tag AND filter', () => {
    const tokens: Token[] = [
      { type: TokenType.TAG, value: 'product', raw: '#product', position: 0 },
      { type: TokenType.FILTER, value: { key: 'type', value: 'glossary' }, raw: 'type:glossary', position: 9 },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<AndNode>({
      type: 'AND',
      left: { type: 'TAG', value: 'product' },
      right: { type: 'FILTER', key: 'type', value: 'glossary' },
    });
  });
});

describe('Parser - Operator Precedence', () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
  });

  // Precedence: () > + > - > |
  // Test: #a | #b + #c should be parsed as #a | (#b + #c)
  it('should handle OR with lower precedence than AND', () => {
    const tokens: Token[] = [
      { type: TokenType.TAG, value: 'a', raw: '#a', position: 0 },
      { type: TokenType.OR, value: '|', raw: '|', position: 3 },
      { type: TokenType.TAG, value: 'b', raw: '#b', position: 5 },
      { type: TokenType.AND, value: '+', raw: '+', position: 8 },
      { type: TokenType.TAG, value: 'c', raw: '#c', position: 10 },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<OrNode>({
      type: 'OR',
      left: { type: 'TAG', value: 'a' },
      right: {
        type: 'AND',
        left: { type: 'TAG', value: 'b' },
        right: { type: 'TAG', value: 'c' },
      },
    });
  });

  // Test: #a + #b - #c should be parsed as (#a + #b) - #c
  it('should handle NOT with lower precedence than AND', () => {
    const tokens: Token[] = [
      { type: TokenType.TAG, value: 'a', raw: '#a', position: 0 },
      { type: TokenType.AND, value: '+', raw: '+', position: 3 },
      { type: TokenType.TAG, value: 'b', raw: '#b', position: 5 },
      { type: TokenType.NOT, value: '-', raw: '-', position: 8 },
      { type: TokenType.TAG, value: 'c', raw: '#c', position: 10 },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<NotNode>({
      type: 'NOT',
      left: {
        type: 'AND',
        left: { type: 'TAG', value: 'a' },
        right: { type: 'TAG', value: 'b' },
      },
      right: { type: 'TAG', value: 'c' },
    });
  });

  // Test: #a - #b | #c should be parsed as (#a - #b) | #c
  it('should handle NOT with higher precedence than OR', () => {
    const tokens: Token[] = [
      { type: TokenType.TAG, value: 'a', raw: '#a', position: 0 },
      { type: TokenType.NOT, value: '-', raw: '-', position: 3 },
      { type: TokenType.TAG, value: 'b', raw: '#b', position: 5 },
      { type: TokenType.OR, value: '|', raw: '|', position: 8 },
      { type: TokenType.TAG, value: 'c', raw: '#c', position: 10 },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<OrNode>({
      type: 'OR',
      left: {
        type: 'NOT',
        left: { type: 'TAG', value: 'a' },
        right: { type: 'TAG', value: 'b' },
      },
      right: { type: 'TAG', value: 'c' },
    });
  });
});

describe('Parser - Parentheses', () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
  });

  // Test: (#a + #b) should parse same as #a + #b
  it('should parse simple parenthesized expression', () => {
    const tokens: Token[] = [
      { type: TokenType.LPAREN, value: '(', raw: '(', position: 0 },
      { type: TokenType.TAG, value: 'a', raw: '#a', position: 1 },
      { type: TokenType.AND, value: '+', raw: '+', position: 4 },
      { type: TokenType.TAG, value: 'b', raw: '#b', position: 6 },
      { type: TokenType.RPAREN, value: ')', raw: ')', position: 8 },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<AndNode>({
      type: 'AND',
      left: { type: 'TAG', value: 'a' },
      right: { type: 'TAG', value: 'b' },
    });
  });

  // Test: (#a | #b) + #c should force OR to have higher precedence
  it('should override precedence with parentheses', () => {
    const tokens: Token[] = [
      { type: TokenType.LPAREN, value: '(', raw: '(', position: 0 },
      { type: TokenType.TAG, value: 'a', raw: '#a', position: 1 },
      { type: TokenType.OR, value: '|', raw: '|', position: 4 },
      { type: TokenType.TAG, value: 'b', raw: '#b', position: 6 },
      { type: TokenType.RPAREN, value: ')', raw: ')', position: 8 },
      { type: TokenType.AND, value: '+', raw: '+', position: 10 },
      { type: TokenType.TAG, value: 'c', raw: '#c', position: 12 },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<AndNode>({
      type: 'AND',
      left: {
        type: 'OR',
        left: { type: 'TAG', value: 'a' },
        right: { type: 'TAG', value: 'b' },
      },
      right: { type: 'TAG', value: 'c' },
    });
  });

  // Test: #a + (#b | #c) should force OR evaluation first
  it('should handle parentheses on right side', () => {
    const tokens: Token[] = [
      { type: TokenType.TAG, value: 'a', raw: '#a', position: 0 },
      { type: TokenType.AND, value: '+', raw: '+', position: 3 },
      { type: TokenType.LPAREN, value: '(', raw: '(', position: 5 },
      { type: TokenType.TAG, value: 'b', raw: '#b', position: 6 },
      { type: TokenType.OR, value: '|', raw: '|', position: 9 },
      { type: TokenType.TAG, value: 'c', raw: '#c', position: 11 },
      { type: TokenType.RPAREN, value: ')', raw: ')', position: 13 },
    ];

    const ast = parser.parse(tokens);

    expect(ast).toEqual<AndNode>({
      type: 'AND',
      left: { type: 'TAG', value: 'a' },
      right: {
        type: 'OR',
        left: { type: 'TAG', value: 'b' },
        right: { type: 'TAG', value: 'c' },
      },
    });
  });
});

describe('Parser - Complex Expressions', () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
  });

  // Spec 01 - Example 8: Complex selector
  // pack:onboarding.basics + [[Brand One-Pager]] - #deprecated
  it('should parse complex expression from Spec Example 8', () => {
    const tokens: Token[] = [
      { type: TokenType.PACK, value: 'onboarding.basics', raw: 'pack:onboarding.basics', position: 0 },
      { type: TokenType.AND, value: '+', raw: '+', position: 23 },
      { type: TokenType.TITLE, value: 'Brand One-Pager', raw: '[[Brand One-Pager]]', position: 25 },
      { type: TokenType.NOT, value: '-', raw: '-', position: 45 },
      { type: TokenType.TAG, value: 'deprecated', raw: '#deprecated', position: 47 },
    ];

    const ast = parser.parse(tokens);

    // Should parse as: (pack + title) - tag
    expect(ast).toEqual<NotNode>({
      type: 'NOT',
      left: {
        type: 'AND',
        left: { type: 'PACK', value: 'onboarding.basics' },
        right: { type: 'TITLE', value: 'Brand One-Pager' },
      },
      right: { type: 'TAG', value: 'deprecated' },
    });
  });

  // Multiple operations with precedence
  it('should parse multiple operations respecting precedence', () => {
    const tokens: Token[] = [
      { type: TokenType.TAG, value: 'a', raw: '#a', position: 0 },
      { type: TokenType.OR, value: '|', raw: '|', position: 3 },
      { type: TokenType.TAG, value: 'b', raw: '#b', position: 5 },
      { type: TokenType.AND, value: '+', raw: '+', position: 8 },
      { type: TokenType.TAG, value: 'c', raw: '#c', position: 10 },
      { type: TokenType.NOT, value: '-', raw: '-', position: 13 },
      { type: TokenType.TAG, value: 'd', raw: '#d', position: 15 },
    ];

    const ast = parser.parse(tokens);

    // Should parse as: #a | ((#b + #c) - #d)
    expect(ast).toEqual<OrNode>({
      type: 'OR',
      left: { type: 'TAG', value: 'a' },
      right: {
        type: 'NOT',
        left: {
          type: 'AND',
          left: { type: 'TAG', value: 'b' },
          right: { type: 'TAG', value: 'c' },
        },
        right: { type: 'TAG', value: 'd' },
      },
    });
  });
});

describe('Parser - Error Cases', () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
  });

  it('should throw on empty token stream', () => {
    const tokens: Token[] = [];

    expect(() => parser.parse(tokens)).toThrow(ParserError);
    expect(() => parser.parse(tokens)).toThrow('Empty token stream');
  });

  it('should throw on operator without left operand', () => {
    const tokens: Token[] = [
      { type: TokenType.AND, value: '+', raw: '+', position: 0 },
      { type: TokenType.TAG, value: 'a', raw: '#a', position: 2 },
    ];

    expect(() => parser.parse(tokens)).toThrow(ParserError);
  });

  it('should throw on operator without right operand', () => {
    const tokens: Token[] = [
      { type: TokenType.TAG, value: 'a', raw: '#a', position: 0 },
      { type: TokenType.AND, value: '+', raw: '+', position: 3 },
    ];

    expect(() => parser.parse(tokens)).toThrow(ParserError);
  });

  it('should throw on mismatched parentheses (unclosed)', () => {
    const tokens: Token[] = [
      { type: TokenType.LPAREN, value: '(', raw: '(', position: 0 },
      { type: TokenType.TAG, value: 'a', raw: '#a', position: 1 },
    ];

    expect(() => parser.parse(tokens)).toThrow(ParserError);
    expect(() => parser.parse(tokens)).toThrow('Unclosed parenthesis');
  });

  it('should throw on mismatched parentheses (unexpected close)', () => {
    const tokens: Token[] = [
      { type: TokenType.TAG, value: 'a', raw: '#a', position: 0 },
      { type: TokenType.RPAREN, value: ')', raw: ')', position: 3 },
    ];

    expect(() => parser.parse(tokens)).toThrow(ParserError);
    expect(() => parser.parse(tokens)).toThrow('Unexpected closing parenthesis');
  });
});
