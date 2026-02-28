/**
 * Context Nest - A Wiki-Style Knowledge Management System
 *
 * This module provides a complete wiki-style document management system
 * with collaboration features, version control, and approval workflows.
 *
 * Key Features:
 * - Wiki-style markdown documents with [[links]], @mentions, #tags
 * - Document versioning with restore capability
 * - Collaborative editing with locking
 * - Context stewardship (approval workflows)
 * - Backlinks and graph navigation
 *
 * Architecture:
 * - Adapter-based design for platform independence
 * - Can run standalone or embedded in larger applications
 * - PromptOwl adapters provided for integration
 *
 * Usage:
 * ```typescript
 * import { createPromptOwlContextNestConfig } from '@/lib/context-nest';
 *
 * const config = createPromptOwlContextNestConfig();
 * // Use config.documents, config.stewardship, etc.
 * ```
 */

// Core types
export * from "./types";

// Adapter interfaces
export * from "./adapters";

// PromptOwl-specific adapters
export {
  createPromptOwlAuthAdapter,
  createPromptOwlDocumentAdapter,
  createPromptOwlStewardshipAdapter,
  createPromptOwlTagAdapter,
  createPromptOwlUserAdapter,
  createPromptOwlContextNestConfig,
} from "./promptowl-adapters";

// Re-export markdown parser (already decoupled)
export {
  parseMarkdownDocument,
  extractTags,
  extractWikiLinks,
  extractMentions,
  extractTasks,
  renderWikiLink,
  renderMention,
  renderTag,
} from "../markdownParser";
export type { WikiLink, Mention, Task, ParsedDocument } from "../markdownParser";

// Serializers for Context Nest spec format
export {
  serializeDocument,
  deserializeDocument,
  documentToMarkdown,
  parseMarkdown,
  serializeStewards,
  deserializeStewards,
  generateIndex,
  serializeVersionHistory,
  titleToFilename,
  extractMetadata,
} from "./serializers";
export type {
  SerializedFrontmatter,
  SerializedDocument,
  SerializedSteward,
  SerializedStewardsConfig,
  SerializedNestConfig,
  SerializedVersionHistory,
  SerializedIndex,
  UserEmailLookup,
} from "./serializers";

// Export/Import functions
export {
  exportContextNest,
  exportToZip,
  importContextNest,
  importFromObsidian,
} from "./export-import";
export type { ExportedFile, ExportResult, ImportResult } from "./export-import";
