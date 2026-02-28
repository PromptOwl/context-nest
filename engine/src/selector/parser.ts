/**
 * Selector Parser
 * Converts token stream to Abstract Syntax Tree (AST)
 *
 * Spec: specs/01-selector-grammar.md
 * Tests: src/selector/parser.test.ts
 *
 * Operator precedence (highest to lowest):
 * 1. Parentheses ()
 * 2. AND (+)
 * 3. NOT (-)
 * 4. OR (|)
 *
 * Grammar (recursive descent):
 * expression  ::= or_expr
 * or_expr     ::= not_expr ('|' not_expr)*
 * not_expr    ::= and_expr ('-' and_expr)*
 * and_expr    ::= primary ('+' primary | primary)*
 * primary     ::= '(' expression ')' | atom
 * atom        ::= TAG | TITLE | OWNER_TITLE | PACK | FILTER
 */

import type { Token } from './tokenizer.js';
import { TokenType } from './tokenizer.js';
import type { ASTNode, TagNode, TitleNode, OwnerTitleNode, PackNode, FilterNode } from './ast.js';

export class ParserError extends Error {
  tokens: Token[];
  position: number;

  constructor(message: string, tokens: Token[], position: number) {
    super(`${message} at position ${position}`);
    this.name = 'ParserError';
    this.tokens = tokens;
    this.position = position;
  }
}

export class Parser {
  private tokens: Token[] = [];
  private current = 0;

  /**
   * Parse token stream into AST
   */
  parse(tokens: Token[]): ASTNode {
    if (tokens.length === 0) {
      throw new ParserError('Empty token stream', tokens, 0);
    }

    this.tokens = tokens;
    this.current = 0;

    const ast = this.expression();

    // Check for unconsumed tokens
    if (!this.isAtEnd()) {
      const remaining = this.peek();
      // Special handling for unexpected closing parenthesis
      if (remaining.type === TokenType.RPAREN) {
        throw new ParserError(
          'Unexpected closing parenthesis',
          this.tokens,
          remaining.position || this.current
        );
      }
      throw new ParserError(
        `Unexpected token: ${remaining.raw}`,
        this.tokens,
        remaining.position || this.current
      );
    }

    return ast;
  }

  /**
   * expression ::= or_expr
   */
  private expression(): ASTNode {
    return this.orExpr();
  }

  /**
   * or_expr ::= not_expr ('|' not_expr)*
   */
  private orExpr(): ASTNode {
    let left = this.notExpr();

    while (this.match(TokenType.OR)) {
      const right = this.notExpr();
      left = {
        type: 'OR',
        left,
        right,
      };
    }

    return left;
  }

  /**
   * not_expr ::= and_expr ('-' and_expr)*
   */
  private notExpr(): ASTNode {
    let left = this.andExpr();

    while (this.match(TokenType.NOT)) {
      const right = this.andExpr();
      left = {
        type: 'NOT',
        left,
        right,
      };
    }

    return left;
  }

  /**
   * and_expr ::= primary ('+' primary | primary)*
   *
   * Note: Implicit AND when no operator between two atoms
   * Example: #tag type:document => #tag + type:document
   */
  private andExpr(): ASTNode {
    let left = this.primary();

    while (
      !this.isAtEnd() &&
      (this.match(TokenType.AND) || this.isAtom())
    ) {
      const right = this.primary();
      left = {
        type: 'AND',
        left,
        right,
      };
    }

    return left;
  }

  /**
   * primary ::= '(' expression ')' | atom
   */
  private primary(): ASTNode {
    // Handle parentheses
    if (this.match(TokenType.LPAREN)) {
      const expr = this.expression();

      if (!this.match(TokenType.RPAREN)) {
        throw new ParserError(
          'Unclosed parenthesis',
          this.tokens,
          this.previous().position || this.current - 1
        );
      }

      return expr;
    }

    return this.atom();
  }

  /**
   * atom ::= TAG | TITLE | OWNER_TITLE | PACK | FILTER
   */
  private atom(): ASTNode {
    // Check if at end (operator without right operand)
    if (this.isAtEnd()) {
      const prevToken = this.previous();
      throw new ParserError(
        'Unexpected end of input',
        this.tokens,
        prevToken.position || this.current - 1
      );
    }

    const token = this.peek();

    // Check for unexpected closing parenthesis
    if (token.type === TokenType.RPAREN) {
      throw new ParserError(
        'Unexpected closing parenthesis',
        this.tokens,
        token.position || this.current
      );
    }

    // Check for operator without left operand
    if (this.isOperator(token.type)) {
      throw new ParserError(
        `Unexpected operator: ${token.raw}`,
        this.tokens,
        token.position || this.current
      );
    }

    if (this.match(TokenType.TAG)) {
      const tagToken = this.previous();
      return {
        type: 'TAG',
        value: tagToken.value,
      } as TagNode;
    }

    if (this.match(TokenType.TITLE)) {
      const titleToken = this.previous();
      return {
        type: 'TITLE',
        value: titleToken.value,
      } as TitleNode;
    }

    if (this.match(TokenType.OWNER_TITLE)) {
      const ownerToken = this.previous();
      return {
        type: 'OWNER_TITLE',
        owner: ownerToken.value.owner,
        title: ownerToken.value.title,
      } as OwnerTitleNode;
    }

    if (this.match(TokenType.PACK)) {
      const packToken = this.previous();
      return {
        type: 'PACK',
        value: packToken.value,
      } as PackNode;
    }

    if (this.match(TokenType.FILTER)) {
      const filterToken = this.previous();
      return {
        type: 'FILTER',
        key: filterToken.value.key,
        value: filterToken.value.value,
      } as FilterNode;
    }

    throw new ParserError(
      `Unexpected token: ${token.raw}`,
      this.tokens,
      token.position || this.current
    );
  }

  /**
   * Helper: Check if current token type matches and advance
   */
  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  /**
   * Helper: Check if current token matches type without advancing
   */
  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  /**
   * Helper: Advance and return previous token
   */
  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  /**
   * Helper: Check if at end of token stream
   */
  private isAtEnd(): boolean {
    return this.current >= this.tokens.length;
  }

  /**
   * Helper: Get current token without advancing
   */
  private peek(): Token {
    return this.tokens[this.current];
  }

  /**
   * Helper: Get previous token
   */
  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  /**
   * Helper: Check if current token is an atom (leaf node)
   */
  private isAtom(): boolean {
    if (this.isAtEnd()) return false;
    const type = this.peek().type;
    return (
      type === TokenType.TAG ||
      type === TokenType.TITLE ||
      type === TokenType.OWNER_TITLE ||
      type === TokenType.PACK ||
      type === TokenType.FILTER
    );
  }

  /**
   * Helper: Check if token type is an operator
   */
  private isOperator(type: TokenType): boolean {
    return (
      type === TokenType.AND ||
      type === TokenType.OR ||
      type === TokenType.NOT
    );
  }
}
