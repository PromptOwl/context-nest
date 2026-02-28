/**
 * Context Nest - Export/Import Functions
 *
 * High-level functions for exporting a Context Nest to files
 * and importing from Obsidian vaults or other Context Nest exports.
 */

import {
  serializeDocument,
  deserializeDocument,
  documentToMarkdown,
  parseMarkdown,
  serializeStewards,
  deserializeStewards,
  generateIndex,
  serializeVersionHistory,
  titleToFilename,
  type SerializedDocument,
  type SerializedNestConfig,
  type SerializedStewardsConfig,
} from "./serializers";
import type {
  ContextDocument,
  ContextSteward,
  DocumentLifecycleStatus,
} from "./types";

// ============================================================================
// Export Types
// ============================================================================

export interface ExportedFile {
  path: string;
  content: string;
}

export interface ExportResult {
  files: ExportedFile[];
  config: SerializedNestConfig;
  stewards: SerializedStewardsConfig;
  stats: {
    totalDocuments: number;
    totalFolders: number;
    totalStewards: number;
  };
}

export interface ImportResult {
  documents: Array<Omit<ContextDocument, "id" | "createdAt" | "updatedAt">>;
  stewards: Array<Omit<ContextSteward, "id">>;
  config: SerializedNestConfig | null;
  errors: Array<{ file: string; error: string }>;
  stats: {
    documentsImported: number;
    documentsSkipped: number;
    stewardsImported: number;
  };
}

// ============================================================================
// Folder structure types
// ============================================================================

interface FolderInfo {
  id: string;
  name: string;
  path: string;
  parentId?: string;
  description?: string;
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export a complete Context Nest to a set of files
 */
export async function exportContextNest(params: {
  dataRoomId: string;
  dataRoomName: string;
  description?: string;
  documents: ContextDocument[];
  stewards: ContextSteward[];
  folders: FolderInfo[];
  userEmails: Record<string, string>;
  includeVersionHistory?: boolean;
}): Promise<ExportResult> {
  const {
    dataRoomId,
    dataRoomName,
    description,
    documents,
    stewards,
    folders,
    userEmails,
    includeVersionHistory = false,
  } = params;

  const files: ExportedFile[] = [];

  // Build folder path lookup
  const folderPaths = buildFolderPaths(folders);
  const documentTitles: Record<string, string> = {};

  // Group documents by folder
  const docsByFolder = new Map<string, ContextDocument[]>();
  for (const doc of documents) {
    const folderId = doc.folderId || "root";
    if (!docsByFolder.has(folderId)) {
      docsByFolder.set(folderId, []);
    }
    docsByFolder.get(folderId)!.push(doc);
    documentTitles[doc.id] = doc.title;
  }

  // Export each document
  for (const doc of documents) {
    const folderPath = doc.folderId ? folderPaths[doc.folderId] || "" : "";
    const serialized = serializeDocument(doc, userEmails, folderPath);
    const markdown = documentToMarkdown(serialized);

    const filePath = folderPath
      ? `${folderPath}/${serialized.filename}`
      : serialized.filename;

    files.push({
      path: filePath,
      content: markdown,
    });

    // Export version history if requested
    if (includeVersionHistory && doc.versions.length > 0) {
      const historyPath = folderPath
        ? `${folderPath}/.versions/${titleToFilename(doc.title)}/history.yaml`
        : `.versions/${titleToFilename(doc.title)}/history.yaml`;

      const history = serializeVersionHistory(doc.versions, userEmails);
      files.push({
        path: historyPath,
        content: serializeYaml(history),
      });

      // Export each version
      for (const version of doc.versions) {
        const versionPath = folderPath
          ? `${folderPath}/.versions/${titleToFilename(doc.title)}/v${version.version}.md`
          : `.versions/${titleToFilename(doc.title)}/v${version.version}.md`;

        files.push({
          path: versionPath,
          content: version.content,
        });
      }
    }
  }

  // Generate INDEX.md for root
  const rootDocs = docsByFolder.get("root") || [];
  const rootSubfolders = folders
    .filter((f) => !f.parentId)
    .map((f) => ({
      name: f.name,
      path: f.path || f.name.toLowerCase(),
      description: f.description,
    }));

  files.push({
    path: "INDEX.md",
    content: generateIndex(
      dataRoomName,
      description,
      rootDocs.map((d) => ({
        title: d.title,
        status: d.lifecycleStatus,
        tags: d.tags,
        updatedAt: d.updatedAt,
      })),
      rootSubfolders
    ),
  });

  // Generate INDEX.md for each folder
  for (const folder of folders) {
    const folderDocs = docsByFolder.get(folder.id) || [];
    const subfolders = folders
      .filter((f) => f.parentId === folder.id)
      .map((f) => ({
        name: f.name,
        path: f.path || f.name.toLowerCase(),
        description: f.description,
      }));

    const folderPath = folderPaths[folder.id] || folder.name.toLowerCase();

    files.push({
      path: `${folderPath}/INDEX.md`,
      content: generateIndex(
        folder.name,
        folder.description,
        folderDocs.map((d) => ({
          title: d.title,
          status: d.lifecycleStatus,
          tags: d.tags,
          updatedAt: d.updatedAt,
        })),
        subfolders
      ),
    });
  }

  // Generate config.yaml
  const config: SerializedNestConfig = {
    version: 1,
    name: dataRoomName,
    description,
    defaults: {
      status: "draft",
      require_approval: true,
    },
    sync: {
      promptowl_data_room_id: dataRoomId,
      auto_index: true,
    },
  };

  files.push({
    path: ".context/config.yaml",
    content: serializeYaml(config),
  });

  // Generate stewards.yaml
  const stewardsConfig = serializeStewards(stewards, userEmails, documentTitles);

  files.push({
    path: ".context/stewards.yaml",
    content: serializeYaml(stewardsConfig),
  });

  return {
    files,
    config,
    stewards: stewardsConfig,
    stats: {
      totalDocuments: documents.length,
      totalFolders: folders.length,
      totalStewards: stewards.length,
    },
  };
}

/**
 * Export to a ZIP file (returns blob-compatible data)
 */
export async function exportToZip(exportResult: ExportResult): Promise<{
  files: Array<{ path: string; content: string }>;
  rootFolderName: string;
}> {
  return {
    files: exportResult.files,
    rootFolderName: exportResult.config.name.toLowerCase().replace(/\s+/g, "-"),
  };
}

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Import a Context Nest from a set of files
 */
export async function importContextNest(params: {
  files: Array<{ path: string; content: string }>;
  dataRoomId: string;
  userIds: Record<string, string>; // email -> userId
  folderIds: Record<string, string>; // path -> folderId
  skipExisting?: boolean;
  existingTitles?: Set<string>;
}): Promise<ImportResult> {
  const {
    files,
    dataRoomId,
    userIds,
    folderIds,
    skipExisting = false,
    existingTitles = new Set(),
  } = params;

  const documents: Array<Omit<ContextDocument, "id" | "createdAt" | "updatedAt">> = [];
  const errors: Array<{ file: string; error: string }> = [];
  let config: SerializedNestConfig | null = null;
  let stewardsConfig: SerializedStewardsConfig | null = null;
  let documentsSkipped = 0;

  // First pass: find config and stewards files
  for (const file of files) {
    if (file.path === ".context/config.yaml" || file.path.endsWith("/.context/config.yaml")) {
      try {
        config = parseYaml(file.content) as unknown as SerializedNestConfig;
      } catch (e) {
        errors.push({ file: file.path, error: `Failed to parse config: ${e}` });
      }
    }

    if (file.path === ".context/stewards.yaml" || file.path.endsWith("/.context/stewards.yaml")) {
      try {
        stewardsConfig = parseYaml(file.content) as unknown as SerializedStewardsConfig;
      } catch (e) {
        errors.push({ file: file.path, error: `Failed to parse stewards: ${e}` });
      }
    }
  }

  // Second pass: import documents
  for (const file of files) {
    // Skip config files, INDEX files, and version history
    if (
      file.path.includes(".context/") ||
      file.path.includes(".versions/") ||
      file.path.endsWith("INDEX.md") ||
      !file.path.endsWith(".md")
    ) {
      continue;
    }

    try {
      const { frontmatter, body } = parseMarkdown(file.content);

      // Skip if document already exists
      if (skipExisting && existingTitles.has(frontmatter.title)) {
        documentsSkipped++;
        continue;
      }

      // Determine folder from path
      const pathParts = file.path.split("/");
      pathParts.pop(); // Remove filename
      const folderPath = pathParts.join("/");
      const folderId = folderPath ? folderIds[folderPath] : undefined;

      const serialized: SerializedDocument = {
        frontmatter,
        body,
        filename: file.path.split("/").pop() || "untitled.md",
        folderPath,
      };

      const doc = deserializeDocument(serialized, dataRoomId, folderId, userIds);
      documents.push(doc);
    } catch (e) {
      errors.push({ file: file.path, error: `Failed to parse document: ${e}` });
    }
  }

  // Build document title -> id mapping for stewards (will be updated after docs are created)
  const documentIds: Record<string, string> = {};
  // Note: In real usage, you'd create documents first, then map their IDs

  // Import stewards
  let stewards: Array<Omit<ContextSteward, "id">> = [];
  if (stewardsConfig) {
    stewards = deserializeStewards(stewardsConfig, dataRoomId, userIds, documentIds, folderIds);
  }

  return {
    documents,
    stewards,
    config,
    errors,
    stats: {
      documentsImported: documents.length,
      documentsSkipped,
      stewardsImported: stewards.length,
    },
  };
}

/**
 * Import from an Obsidian vault (simplified - just markdown files)
 */
export async function importFromObsidian(params: {
  files: Array<{ path: string; content: string }>;
  dataRoomId: string;
  defaultOwnerId: string;
}): Promise<ImportResult> {
  const { files, dataRoomId, defaultOwnerId } = params;

  const documents: Array<Omit<ContextDocument, "id" | "createdAt" | "updatedAt">> = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const file of files) {
    // Only process markdown files
    if (!file.path.endsWith(".md")) continue;

    // Skip Obsidian system files
    if (file.path.includes(".obsidian/") || file.path.includes(".trash/")) continue;

    try {
      const { frontmatter, body } = parseMarkdown(file.content);

      // For Obsidian, use filename as title if not in frontmatter
      if (frontmatter.title === "Untitled") {
        const filename = file.path.split("/").pop() || "untitled.md";
        frontmatter.title = filename.replace(/\.md$/, "");
      }

      // Determine folder from path
      const pathParts = file.path.split("/");
      pathParts.pop(); // Remove filename
      const folderPath = pathParts.join("/");

      const serialized: SerializedDocument = {
        frontmatter,
        body,
        filename: file.path.split("/").pop() || "untitled.md",
        folderPath,
      };

      // Use empty userIds since Obsidian doesn't have PromptOwl users
      const doc = deserializeDocument(serialized, dataRoomId, undefined, {});

      // Set default owner
      doc.ownerId = defaultOwnerId;

      documents.push(doc);
    } catch (e) {
      errors.push({ file: file.path, error: `Failed to parse: ${e}` });
    }
  }

  return {
    documents,
    stewards: [],
    config: null,
    errors,
    stats: {
      documentsImported: documents.length,
      documentsSkipped: 0,
      stewardsImported: 0,
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Build folder ID -> path mapping
 */
function buildFolderPaths(folders: FolderInfo[]): Record<string, string> {
  const paths: Record<string, string> = {};
  const folderMap = new Map(folders.map((f) => [f.id, f]));

  function buildPath(folder: FolderInfo): string {
    if (folder.path) return folder.path;

    const name = folder.name.toLowerCase().replace(/\s+/g, "-");
    if (!folder.parentId) return name;

    const parent = folderMap.get(folder.parentId);
    if (!parent) return name;

    return `${buildPath(parent)}/${name}`;
  }

  for (const folder of folders) {
    paths[folder.id] = buildPath(folder);
  }

  return paths;
}

/**
 * Simple YAML serializer (for our specific structures)
 */
function serializeYaml(obj: unknown, indent: number = 0): string {
  if (typeof obj !== "object" || obj === null) {
    return String(obj);
  }
  const record = obj as Record<string, unknown>;
  const prefix = "  ".repeat(indent);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;

      // Check if array of objects or primitives
      if (typeof value[0] === "object") {
        lines.push(`${prefix}${key}:`);
        for (const item of value) {
          lines.push(`${prefix}  - ${serializeYamlObject(item as Record<string, unknown>, indent + 2)}`);
        }
      } else {
        lines.push(`${prefix}${key}:`);
        for (const item of value) {
          lines.push(`${prefix}  - ${item}`);
        }
      }
    } else if (typeof value === "object") {
      lines.push(`${prefix}${key}:`);
      lines.push(serializeYaml(value as Record<string, unknown>, indent + 1));
    } else if (typeof value === "string") {
      if (value.includes(":") || value.includes("#") || value.includes("\n")) {
        lines.push(`${prefix}${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${prefix}${key}: ${value}`);
      }
    } else {
      lines.push(`${prefix}${key}: ${value}`);
    }
  }

  return lines.join("\n");
}

/**
 * Serialize an object for inline YAML (for array items)
 */
function serializeYamlObject(obj: Record<string, unknown>, indent: number): string {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return "{}";

  const lines = entries.map(([k, v]) => {
    const prefix = "  ".repeat(indent);
    if (typeof v === "string") {
      return `${prefix}${k}: ${v}`;
    }
    return `${prefix}${k}: ${v}`;
  });

  // First item on same line as dash
  return lines[0].trim() + (lines.length > 1 ? "\n" + lines.slice(1).join("\n") : "");
}

/**
 * Simple YAML parser (for our specific structures)
 */
function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [
    { obj: result, indent: -1 },
  ];

  let currentArray: unknown[] | null = null;
  let currentArrayKey: string | null = null;
  let currentArrayIndent = 0;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Handle array item
    if (trimmed.startsWith("- ")) {
      if (currentArray) {
        const value = trimmed.slice(2).trim();
        // Check if it's an object (has colon)
        if (value.includes(":")) {
          const obj = parseInlineYaml(value);
          currentArray.push(obj);
        } else {
          currentArray.push(value);
        }
      }
      continue;
    }

    // Save current array if moving to different key
    if (currentArray && currentArrayKey) {
      const target = stack[stack.length - 1].obj;
      target[currentArrayKey] = currentArray;
      currentArray = null;
      currentArrayKey = null;
    }

    // Parse key: value
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();

    // Pop stack for dedents
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const target = stack[stack.length - 1].obj;

    if (!value) {
      // Check next line to determine if array or object
      const nextLineIndex = lines.indexOf(line) + 1;
      if (nextLineIndex < lines.length) {
        const nextLine = lines[nextLineIndex].trim();
        if (nextLine.startsWith("- ")) {
          currentArray = [];
          currentArrayKey = key;
          currentArrayIndent = indent;
        } else {
          // Nested object
          const nested: Record<string, unknown> = {};
          target[key] = nested;
          stack.push({ obj: nested, indent });
        }
      }
    } else {
      // Parse value
      let parsedValue: unknown = value;
      if (value.startsWith('"') && value.endsWith('"')) {
        parsedValue = value.slice(1, -1);
      } else if (value === "true") {
        parsedValue = true;
      } else if (value === "false") {
        parsedValue = false;
      } else if (!isNaN(Number(value))) {
        parsedValue = Number(value);
      }
      target[key] = parsedValue;
    }
  }

  // Save final array if any
  if (currentArray && currentArrayKey) {
    const target = stack[stack.length - 1].obj;
    target[currentArrayKey] = currentArray;
  }

  return result;
}

/**
 * Parse inline YAML object (from array item)
 */
function parseInlineYaml(line: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const parts = line.split(/,\s*/);

  for (const part of parts) {
    const colonIndex = part.indexOf(":");
    if (colonIndex === -1) continue;

    const key = part.slice(0, colonIndex).trim();
    let value: unknown = part.slice(colonIndex + 1).trim();

    if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (!isNaN(Number(value))) value = Number(value);

    result[key] = value;
  }

  return result;
}
