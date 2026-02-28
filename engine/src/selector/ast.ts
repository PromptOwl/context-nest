/**
 * Abstract Syntax Tree (AST) definitions for selector expressions
 *
 * Spec: specs/01-selector-grammar.md
 *
 * AST represents the parsed structure of a selector query.
 * Each node type corresponds to a selector pattern.
 */

/**
 * Leaf nodes - represent atomic selectors
 */

/** Tag selector: #onboarding */
export interface TagNode {
  type: 'TAG';
  value: string; // tag name without #
}

/** Title transclusion: [[Brand Guidelines]] */
export interface TitleNode {
  type: 'TITLE';
  value: string; // title without brackets
}

/** Owner-scoped title: @legal/Contract Template */
export interface OwnerTitleNode {
  type: 'OWNER_TITLE';
  owner: string;
  title: string;
}

/** Pack reference: pack:onboarding.basics */
export interface PackNode {
  type: 'PACK';
  value: string; // pack id after pack:
}

/** Filter expression: type:document, scope:public */
export interface FilterNode {
  type: 'FILTER';
  key: string;
  value: string;
}

/**
 * Binary operation nodes - combine two selectors
 */

/** AND operation: #a + #b (intersection) */
export interface AndNode {
  type: 'AND';
  left: ASTNode;
  right: ASTNode;
}

/** OR operation: #a | #b (union) */
export interface OrNode {
  type: 'OR';
  left: ASTNode;
  right: ASTNode;
}

/** NOT operation: #a - #b (difference) */
export interface NotNode {
  type: 'NOT';
  left: ASTNode;
  right: ASTNode;
}

/**
 * Union type for all AST nodes
 */
export type ASTNode =
  | TagNode
  | TitleNode
  | OwnerTitleNode
  | PackNode
  | FilterNode
  | AndNode
  | OrNode
  | NotNode;

/**
 * Type guards for AST nodes
 */

export function isTagNode(node: ASTNode): node is TagNode {
  return node.type === 'TAG';
}

export function isTitleNode(node: ASTNode): node is TitleNode {
  return node.type === 'TITLE';
}

export function isOwnerTitleNode(node: ASTNode): node is OwnerTitleNode {
  return node.type === 'OWNER_TITLE';
}

export function isPackNode(node: ASTNode): node is PackNode {
  return node.type === 'PACK';
}

export function isFilterNode(node: ASTNode): node is FilterNode {
  return node.type === 'FILTER';
}

export function isAndNode(node: ASTNode): node is AndNode {
  return node.type === 'AND';
}

export function isOrNode(node: ASTNode): node is OrNode {
  return node.type === 'OR';
}

export function isNotNode(node: ASTNode): node is NotNode {
  return node.type === 'NOT';
}

/**
 * Helper to check if node is a binary operation
 */
export function isBinaryOp(node: ASTNode): node is AndNode | OrNode | NotNode {
  return isAndNode(node) || isOrNode(node) || isNotNode(node);
}

/**
 * Helper to check if node is a leaf (atomic selector)
 */
export function isLeafNode(node: ASTNode): node is TagNode | TitleNode | OwnerTitleNode | PackNode | FilterNode {
  return isTagNode(node) || isTitleNode(node) || isOwnerTitleNode(node) ||
         isPackNode(node) || isFilterNode(node);
}
