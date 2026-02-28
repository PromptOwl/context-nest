/**
 * Selector Tokenizer
 * Breaks selector strings into tokens for parsing
 *
 * Spec: specs/01-selector-grammar.md
 * Tests: src/selector/tokenizer.test.ts
 *
 * Supports configurable syntax via syntax.yml (Obsidian/Owlpad compatibility)
 */

import type { SyntaxConfig } from '../types/index.js';

export enum TokenType {
  TAG = 'TAG', // #tag
  TITLE = 'TITLE', // [[Title]]
  OWNER_TITLE = 'OWNER_TITLE', // @owner/Title
  PACK = 'PACK', // pack:id
  FILTER = 'FILTER', // key:value
  AND = 'AND', // +
  OR = 'OR', // |
  NOT = 'NOT', // -
  LPAREN = 'LPAREN', // (
  RPAREN = 'RPAREN', // )
}

export interface Token {
  type: TokenType;
  value: any;
  raw: string;
  position?: number;
}

export class TokenizerError extends Error {
  position?: number;

  constructor(message: string, position?: number) {
    super(message + (position !== undefined ? ` at position ${position}` : ''));
    this.name = 'TokenizerError';
    this.position = position;
  }
}

/**
 * Default syntax configuration (Obsidian-style)
 */
const DEFAULT_SYNTAX: SyntaxConfig = {
  tokens: {
    title_transclusion: '[[{{title}}]]',
    tag: '#{{tag}}',
    owner_scope: '@{{owner}}/{{title}}',
    pack_reference: 'pack:{{pack_id}}',
  },
};

/**
 * Parse syntax pattern to extract prefix and suffix
 */
function parseSyntaxPattern(pattern: string): { prefix: string; suffix: string } {
  const match = pattern.match(/^(.+?)\{\{.+?\}\}(.*)$/);
  if (!match) {
    throw new Error(`Invalid syntax pattern: ${pattern}`);
  }
  return { prefix: match[1], suffix: match[2] };
}

export class Tokenizer {
  private syntax: SyntaxConfig;
  private titlePattern: { prefix: string; suffix: string };
  private tagPrefix: string;
  private ownerPattern: { prefix: string; separator: string };
  private packPrefix: string;

  constructor(syntax: SyntaxConfig = DEFAULT_SYNTAX) {
    this.syntax = syntax;

    // Parse syntax patterns
    this.titlePattern = parseSyntaxPattern(syntax.tokens.title_transclusion);
    this.tagPrefix = parseSyntaxPattern(syntax.tokens.tag).prefix;
    this.packPrefix = parseSyntaxPattern(syntax.tokens.pack_reference).prefix;

    // Parse owner pattern (format: @{{owner}}/{{title}} or {{owner}}:{{title}})
    // Allow empty prefix (.*? instead of .+?)
    const ownerMatch = syntax.tokens.owner_scope.match(/^(.*?)\{\{owner\}\}(.+?)\{\{title\}\}$/);
    if (!ownerMatch) {
      throw new Error(`Invalid owner_scope pattern: ${syntax.tokens.owner_scope}`);
    }
    this.ownerPattern = { prefix: ownerMatch[1], separator: ownerMatch[2] };
  }

  /**
   * Tokenize a selector string
   */
  tokenize(selector: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const input = selector.trim();

    while (i < input.length) {
      // Skip whitespace
      if (/\s/.test(input[i])) {
        i++;
        continue;
      }

      const start = i;

      // Operators
      if (input[i] === '+') {
        tokens.push({ type: TokenType.AND, value: '+', raw: '+', position: start });
        i++;
        continue;
      }

      if (input[i] === '|') {
        tokens.push({ type: TokenType.OR, value: '|', raw: '|', position: start });
        i++;
        continue;
      }

      if (input[i] === '-') {
        tokens.push({ type: TokenType.NOT, value: '-', raw: '-', position: start });
        i++;
        continue;
      }

      if (input[i] === '(') {
        tokens.push({ type: TokenType.LPAREN, value: '(', raw: '(', position: start });
        i++;
        continue;
      }

      if (input[i] === ')') {
        tokens.push({ type: TokenType.RPAREN, value: ')', raw: ')', position: start });
        i++;
        continue;
      }

      // Title transclusion
      if (input.startsWith(this.titlePattern.prefix, i)) {
        const result = this.readTitle(input, i);
        tokens.push(result.token);
        i = result.nextPos;
        continue;
      }

      // Tag
      if (input.startsWith(this.tagPrefix, i)) {
        const result = this.readTag(input, i);
        tokens.push(result.token);
        i = result.nextPos;
        continue;
      }

      // Owner-scoped title
      if (input.startsWith(this.ownerPattern.prefix, i)) {
        const result = this.readOwnerTitle(input, i);
        tokens.push(result.token);
        i = result.nextPos;
        continue;
      }

      // Pack reference
      if (input.startsWith(this.packPrefix, i)) {
        const result = this.readPack(input, i);
        tokens.push(result.token);
        i = result.nextPos;
        continue;
      }

      // Filter (key:value)
      if (/[a-zA-Z]/.test(input[i])) {
        const result = this.readFilter(input, i);
        if (result) {
          tokens.push(result.token);
          i = result.nextPos;
          continue;
        }
      }

      // Unexpected character
      throw new TokenizerError(`Unexpected character '${input[i]}'`, start);
    }

    return tokens;
  }

  /**
   * Read title transclusion: [[Title]] or custom syntax
   */
  private readTitle(input: string, start: number): { token: Token; nextPos: number } {
    const prefixLen = this.titlePattern.prefix.length;
    const suffixLen = this.titlePattern.suffix.length;

    let i = start + prefixLen;
    const titleStart = i;

    // Find closing suffix
    while (i < input.length) {
      if (input.startsWith(this.titlePattern.suffix, i)) {
        const title = input.substring(titleStart, i);
        const raw = input.substring(start, i + suffixLen);
        return {
          token: { type: TokenType.TITLE, value: title, raw, position: start },
          nextPos: i + suffixLen,
        };
      }
      i++;
    }

    throw new TokenizerError('Unclosed title transclusion', start);
  }

  /**
   * Read tag: #tag or custom prefix
   */
  private readTag(input: string, start: number): { token: Token; nextPos: number } {
    const prefixLen = this.tagPrefix.length;
    let i = start + prefixLen;

    // Read tag name (alphanumeric, hyphen, underscore)
    while (i < input.length && /[a-zA-Z0-9_-]/.test(input[i])) {
      i++;
    }

    const tag = input.substring(start + prefixLen, i);
    const raw = input.substring(start, i);

    return {
      token: { type: TokenType.TAG, value: tag, raw, position: start },
      nextPos: i,
    };
  }

  /**
   * Read owner-scoped title: @owner/Title or custom syntax
   */
  private readOwnerTitle(input: string, start: number): { token: Token; nextPos: number } {
    const prefixLen = this.ownerPattern.prefix.length;
    let i = start + prefixLen;

    // Read owner (alphanumeric, hyphen, underscore)
    const ownerStart = i;
    while (i < input.length && /[a-zA-Z0-9_-]/.test(input[i])) {
      i++;
    }
    const owner = input.substring(ownerStart, i);

    // Expect separator
    if (!input.startsWith(this.ownerPattern.separator, i)) {
      throw new TokenizerError(
        `Expected separator '${this.ownerPattern.separator}' in owner scope`,
        i
      );
    }
    i += this.ownerPattern.separator.length;

    // Read title (until operator or end of string, spaces allowed)
    const titleStart = i;
    while (i < input.length && !/[+|\-()]/.test(input[i])) {
      i++;
    }
    // Trim trailing whitespace from title
    let titleEnd = i;
    while (titleEnd > titleStart && /\s/.test(input[titleEnd - 1])) {
      titleEnd--;
    }
    const title = input.substring(titleStart, titleEnd);

    const raw = input.substring(start, i);

    return {
      token: { type: TokenType.OWNER_TITLE, value: { owner, title }, raw, position: start },
      nextPos: i,
    };
  }

  /**
   * Read pack reference: pack:id or custom prefix
   */
  private readPack(input: string, start: number): { token: Token; nextPos: number } {
    const prefixLen = this.packPrefix.length;
    let i = start + prefixLen;

    // Read pack ID (alphanumeric, dot, hyphen, underscore)
    while (i < input.length && /[a-zA-Z0-9._-]/.test(input[i])) {
      i++;
    }

    const packId = input.substring(start + prefixLen, i);
    const raw = input.substring(start, i);

    return {
      token: { type: TokenType.PACK, value: packId, raw, position: start },
      nextPos: i,
    };
  }

  /**
   * Read filter: key:value
   */
  private readFilter(input: string, start: number): { token: Token; nextPos: number } | null {
    let i = start;

    // Read key
    while (i < input.length && /[a-zA-Z_]/.test(input[i])) {
      i++;
    }

    // Must have colon
    if (i >= input.length || input[i] !== ':') {
      return null; // Not a filter
    }

    const key = input.substring(start, i);
    i++; // Skip colon

    // Read value (alphanumeric, hyphen, underscore, date format)
    const valueStart = i;
    while (i < input.length && /[a-zA-Z0-9_-]/.test(input[i])) {
      i++;
    }

    const value = input.substring(valueStart, i);
    const raw = input.substring(start, i);

    return {
      token: { type: TokenType.FILTER, value: { key, value }, raw, position: start },
      nextPos: i,
    };
  }
}
