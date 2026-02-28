/**
 * Context Nest - Serializers
 *
 * Convert between PromptOwl's internal format and the Context Nest spec format.
 * Enables export to portable files and import from Obsidian vaults.
 */

import type {
  ContextDocument,
  ContextSteward,
  DocumentVersion,
  DocumentLifecycleStatus,
  StewardshipScope,
} from "./types";

// ============================================================================
// Types for serialized format (matches CONTEXT_NEST_SPEC.md)
// ============================================================================

export interface SerializedFrontmatter {
  id?: string;
  title: string;
  tags?: string[];
  status?: "draft" | "pending_review" | "approved" | "rejected";
  version?: number;
  created?: string; // ISO 8601
  updated?: string; // ISO 8601
  author?: string; // email
  owner?: string; // email
  approved_by?: string;
  approved_at?: string;
  approved_version?: number;
  // Extension point for custom fields
  [key: string]: unknown;
}

export interface SerializedDocument {
  frontmatter: SerializedFrontmatter;
  body: string;
  filename: string;
  folderPath: string;
}

export interface SerializedSteward {
  email: string;
  can_approve: boolean;
  can_reject?: boolean;
  can_delegate?: boolean;
}

export interface SerializedStewardsConfig {
  version: 1;
  data_room?: SerializedSteward[];
  folders?: Record<string, SerializedSteward[]>;
  tags?: Record<string, SerializedSteward[]>;
  documents?: Record<string, SerializedSteward[]>;
}

export interface SerializedNestConfig {
  version: 1;
  name: string;
  description?: string;
  defaults?: {
    status?: "draft" | "pending_review" | "approved" | "rejected";
    require_approval?: boolean;
  };
  folders?: Record<
    string,
    {
      description?: string;
      require_approval?: boolean;
      template?: string;
    }
  >;
  sync?: {
    promptowl_data_room_id?: string;
    auto_index?: boolean;
  };
}

export interface SerializedVersionHistory {
  versions: Array<{
    version: number;
    edited_by: string;
    edited_at: string;
    note?: string;
  }>;
}

export interface SerializedIndex {
  title: string;
  description?: string;
  documents: Array<{
    title: string;
    status: string;
    tags: string[];
    updated: string;
  }>;
  subfolders: Array<{
    name: string;
    description?: string;
  }>;
  stats: {
    total: number;
    approved: number;
    pending_review: number;
    draft: number;
  };
  tags: string[];
}

// ============================================================================
// User lookup interface (for email resolution)
// ============================================================================

export interface UserEmailLookup {
  getUserEmail(userId: string): Promise<string | null>;
  getUserIdByEmail(email: string): Promise<string | null>;
}

// ============================================================================
// Document Serialization
// ============================================================================

/**
 * Convert a ContextDocument to the serialized markdown format
 */
export function serializeDocument(
  doc: ContextDocument,
  userEmails: Record<string, string>, // userId -> email mapping
  folderPath: string = ""
): SerializedDocument {
  const frontmatter: SerializedFrontmatter = {
    id: doc.id,
    title: doc.title,
  };

  // Add optional fields only if present
  if (doc.tags.length > 0) {
    frontmatter.tags = doc.tags;
  }

  frontmatter.status = doc.lifecycleStatus;
  frontmatter.version = doc.version;
  frontmatter.created = doc.createdAt.toISOString();
  frontmatter.updated = doc.updatedAt.toISOString();

  if (doc.ownerId && userEmails[doc.ownerId]) {
    frontmatter.author = userEmails[doc.ownerId];
    frontmatter.owner = userEmails[doc.ownerId];
  }

  if (doc.approvedBy && userEmails[doc.approvedBy]) {
    frontmatter.approved_by = userEmails[doc.approvedBy];
  }

  if (doc.approvedAt) {
    frontmatter.approved_at = doc.approvedAt.toISOString();
  }

  if (doc.approvedVersion !== null) {
    frontmatter.approved_version = doc.approvedVersion;
  }

  // Generate filename from title
  const filename = titleToFilename(doc.title) + ".md";

  return {
    frontmatter,
    body: doc.content,
    filename,
    folderPath,
  };
}

/**
 * Convert serialized markdown back to a ContextDocument
 */
export function deserializeDocument(
  serialized: SerializedDocument,
  dataRoomId: string,
  folderId: string | undefined,
  userIds: Record<string, string> // email -> userId mapping
): Omit<ContextDocument, "id" | "createdAt" | "updatedAt"> {
  const { frontmatter, body } = serialized;

  // Extract metadata from body
  const { wikiLinks, mentions, tasks, tags: bodyTags } = extractMetadata(body);

  // Merge tags from frontmatter and body
  const allTags = Array.from(new Set([...(frontmatter.tags || []), ...bodyTags]));

  const doc: Omit<ContextDocument, "id" | "createdAt" | "updatedAt"> = {
    title: frontmatter.title,
    content: body,
    dataRoomId,
    folderId,
    ownerId: frontmatter.owner ? userIds[frontmatter.owner] || "" : "",
    tags: allTags,
    wikiLinks,
    mentions,
    tasks,
    backlinks: [],
    version: frontmatter.version || 1,
    versions: [],
    lifecycleStatus: (frontmatter.status as DocumentLifecycleStatus) || "draft",
    approvedVersion: frontmatter.approved_version ?? null,
  };

  if (frontmatter.approved_by && userIds[frontmatter.approved_by]) {
    doc.approvedBy = userIds[frontmatter.approved_by];
  }

  if (frontmatter.approved_at) {
    doc.approvedAt = new Date(frontmatter.approved_at);
  }

  return doc;
}

/**
 * Serialize a document to a complete markdown string
 */
export function documentToMarkdown(serialized: SerializedDocument): string {
  const yamlFrontmatter = serializeFrontmatter(serialized.frontmatter);
  return `---\n${yamlFrontmatter}---\n\n${serialized.body}`;
}

/**
 * Parse a markdown string into frontmatter and body
 */
export function parseMarkdown(markdown: string): {
  frontmatter: SerializedFrontmatter;
  body: string;
} {
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);

  if (!frontmatterMatch) {
    // No frontmatter, treat entire content as body with default title
    return {
      frontmatter: { title: "Untitled" },
      body: markdown,
    };
  }

  const [, yamlContent, body] = frontmatterMatch;
  const frontmatter = parseFrontmatter(yamlContent);

  return { frontmatter, body };
}

// ============================================================================
// Stewardship Serialization
// ============================================================================

/**
 * Serialize stewards to stewards.yaml format
 */
export function serializeStewards(
  stewards: ContextSteward[],
  userEmails: Record<string, string>,
  documentTitles: Record<string, string> // documentId -> title
): SerializedStewardsConfig {
  const config: SerializedStewardsConfig = { version: 1 };

  // Group by scope
  const byScope = groupBy(stewards, (s) => s.scope);

  // Data room level
  if (byScope.dataRoom) {
    config.data_room = byScope.dataRoom.map((s) => serializeSteward(s, userEmails));
  }

  // Folder level
  if (byScope.folder) {
    config.folders = {};
    const byFolder = groupBy(byScope.folder, (s) => s.folderId || "unknown");
    for (const [folderId, folderStewards] of Object.entries(byFolder)) {
      // Use folderId as key - in real impl would resolve to folder path
      config.folders[folderId] = folderStewards.map((s) => serializeSteward(s, userEmails));
    }
  }

  // Tag level
  if (byScope.tag) {
    config.tags = {};
    const byTag = groupBy(byScope.tag, (s) => s.tagName || "unknown");
    for (const [tagName, tagStewards] of Object.entries(byTag)) {
      config.tags[tagName] = tagStewards.map((s) => serializeSteward(s, userEmails));
    }
  }

  // Document level
  if (byScope.document) {
    config.documents = {};
    const byDoc = groupBy(byScope.document, (s) => s.documentId || "unknown");
    for (const [docId, docStewards] of Object.entries(byDoc)) {
      const title = documentTitles[docId] || docId;
      config.documents[title] = docStewards.map((s) => serializeSteward(s, userEmails));
    }
  }

  return config;
}

/**
 * Deserialize stewards.yaml back to ContextSteward objects
 */
export function deserializeStewards(
  config: SerializedStewardsConfig,
  dataRoomId: string,
  userIds: Record<string, string>, // email -> userId
  documentIds: Record<string, string>, // title -> documentId
  folderIds: Record<string, string> // path -> folderId
): Omit<ContextSteward, "id">[] {
  const stewards: Omit<ContextSteward, "id">[] = [];
  const now = new Date();

  // Data room level
  if (config.data_room) {
    for (const s of config.data_room) {
      const userId = userIds[s.email];
      if (userId) {
        stewards.push({
          dataRoomId,
          scope: "dataRoom",
          stewardUserId: userId,
          canApprove: s.can_approve,
          canReject: s.can_reject ?? false,
          canDelegate: s.can_delegate ?? false,
          assignedBy: userId, // self-assigned from config
          assignedAt: now,
          isActive: true,
        });
      }
    }
  }

  // Folder level
  if (config.folders) {
    for (const [folderPath, folderStewards] of Object.entries(config.folders)) {
      const folderId = folderIds[folderPath];
      for (const s of folderStewards) {
        const userId = userIds[s.email];
        if (userId) {
          stewards.push({
            dataRoomId,
            scope: "folder",
            folderId,
            stewardUserId: userId,
            canApprove: s.can_approve,
            canReject: s.can_reject ?? false,
            canDelegate: s.can_delegate ?? false,
            assignedBy: userId,
            assignedAt: now,
            isActive: true,
          });
        }
      }
    }
  }

  // Tag level
  if (config.tags) {
    for (const [tagName, tagStewards] of Object.entries(config.tags)) {
      for (const s of tagStewards) {
        const userId = userIds[s.email];
        if (userId) {
          stewards.push({
            dataRoomId,
            scope: "tag",
            tagName,
            stewardUserId: userId,
            canApprove: s.can_approve,
            canReject: s.can_reject ?? false,
            canDelegate: s.can_delegate ?? false,
            assignedBy: userId,
            assignedAt: now,
            isActive: true,
          });
        }
      }
    }
  }

  // Document level
  if (config.documents) {
    for (const [docTitle, docStewards] of Object.entries(config.documents)) {
      const documentId = documentIds[docTitle];
      for (const s of docStewards) {
        const userId = userIds[s.email];
        if (userId) {
          stewards.push({
            dataRoomId,
            scope: "document",
            documentId,
            stewardUserId: userId,
            canApprove: s.can_approve,
            canReject: s.can_reject ?? false,
            canDelegate: s.can_delegate ?? false,
            assignedBy: userId,
            assignedAt: now,
            isActive: true,
          });
        }
      }
    }
  }

  return stewards;
}

// ============================================================================
// INDEX.md Generation
// ============================================================================

/**
 * Generate an INDEX.md file for a folder
 */
export function generateIndex(
  folderName: string,
  description: string | undefined,
  documents: Array<{
    title: string;
    status: DocumentLifecycleStatus;
    tags: string[];
    updatedAt: Date;
  }>,
  subfolders: Array<{ name: string; path: string; description?: string }>
): string {
  const now = new Date().toISOString();

  // Calculate stats
  const stats = {
    total: documents.length,
    approved: documents.filter((d) => d.status === "approved").length,
    pending_review: documents.filter((d) => d.status === "pending_review").length,
    draft: documents.filter((d) => d.status === "draft").length,
  };

  // Collect all tags
  const allTags = Array.from(new Set(documents.flatMap((d) => d.tags))).sort();

  // Build markdown
  const lines: string[] = [
    "---",
    `title: "${folderName} Index"`,
    "type: index",
    "auto_generated: true",
    `generated_at: ${now}`,
    "---",
    "",
    `# ${folderName}`,
    "",
  ];

  if (description) {
    lines.push(description, "");
  }

  // Documents table
  lines.push("## Documents", "");
  if (documents.length > 0) {
    lines.push("| Document | Status | Tags | Updated |");
    lines.push("|----------|--------|------|---------|");
    for (const doc of documents) {
      const tagsStr = doc.tags.map((t) => `#${t}`).join(" ");
      const dateStr = doc.updatedAt.toISOString().split("T")[0];
      lines.push(`| [[${doc.title}]] | ${doc.status} | ${tagsStr} | ${dateStr} |`);
    }
  } else {
    lines.push("_No documents in this folder._");
  }
  lines.push("");

  // Subfolders
  if (subfolders.length > 0) {
    lines.push("## Subfolders", "");
    for (const folder of subfolders) {
      const desc = folder.description ? ` - ${folder.description}` : "";
      lines.push(`- [[${folder.path}/INDEX|${folder.name}]]${desc}`);
    }
    lines.push("");
  }

  // Statistics
  lines.push("## Statistics", "");
  lines.push(`- Total documents: ${stats.total}`);
  lines.push(`- Approved: ${stats.approved}`);
  lines.push(`- Pending review: ${stats.pending_review}`);
  lines.push(`- Draft: ${stats.draft}`);
  lines.push("");

  // Tags
  if (allTags.length > 0) {
    lines.push("## Tags in this folder", "");
    lines.push(allTags.map((t) => `#${t}`).join(" "));
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================================
// Version History Serialization
// ============================================================================

/**
 * Serialize version history to YAML format
 */
export function serializeVersionHistory(
  versions: DocumentVersion[],
  userEmails: Record<string, string>
): SerializedVersionHistory {
  return {
    versions: versions.map((v) => ({
      version: v.version,
      edited_by: userEmails[v.editedBy] || v.editedBy,
      edited_at: v.editedAt.toISOString(),
      note: v.changeNote,
    })),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert a title to a kebab-case filename
 */
export function titleToFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Spaces to hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Trim hyphens
}

/**
 * Extract metadata (wiki links, mentions, tasks, tags) from markdown body
 */
export function extractMetadata(body: string): {
  wikiLinks: ContextDocument["wikiLinks"];
  mentions: ContextDocument["mentions"];
  tasks: ContextDocument["tasks"];
  tags: string[];
} {
  const wikiLinks: ContextDocument["wikiLinks"] = [];
  const mentions: ContextDocument["mentions"] = [];
  const tasks: ContextDocument["tasks"] = [];
  const tags: string[] = [];

  // Extract wiki links: [[title]] or [[title|display]]
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match;
  while ((match = wikiLinkRegex.exec(body)) !== null) {
    wikiLinks.push({
      text: match[0],
      displayText: match[2] || match[1],
      targetId: null, // Resolved later
      targetTitle: match[1],
    });
  }

  // Extract mentions: @user or @team:name
  const mentionRegex = /@(team:)?([a-zA-Z0-9._-]+)/g;
  while ((match = mentionRegex.exec(body)) !== null) {
    mentions.push({
      type: match[1] ? "team" : "user",
      name: match[2],
    });
  }

  // Extract tasks: - [ ] or - [x]
  const taskRegex = /^[\s]*-\s*\[([ xX])\]\s*(.+)$/gm;
  let taskIndex = 0;
  while ((match = taskRegex.exec(body)) !== null) {
    const completed = match[1].toLowerCase() === "x";
    const text = match[2].trim();

    // Check for assignee mention in task
    const assigneeMatch = text.match(/@([a-zA-Z0-9._-]+)/);

    tasks.push({
      id: `task_${taskIndex++}`,
      text,
      completed,
      assigneeId: null,
      assigneeName: assigneeMatch ? assigneeMatch[1] : null,
    });
  }

  // Extract inline tags: #tag-name
  const tagRegex = /#([a-zA-Z][a-zA-Z0-9_-]*)/g;
  while ((match = tagRegex.exec(body)) !== null) {
    if (!tags.includes(match[1])) {
      tags.push(match[1]);
    }
  }

  return { wikiLinks, mentions, tasks, tags };
}

/**
 * Serialize frontmatter object to YAML string
 */
function serializeFrontmatter(frontmatter: SerializedFrontmatter): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else if (typeof value === "string") {
      // Quote strings that might need it
      if (value.includes(":") || value.includes("#") || value.includes('"')) {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join("\n");
}

/**
 * Parse YAML frontmatter string to object
 */
function parseFrontmatter(yaml: string): SerializedFrontmatter {
  const result: SerializedFrontmatter = { title: "Untitled" };
  const lines = yaml.split("\n");

  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for array item
    if (trimmed.startsWith("- ") && currentKey && currentArray) {
      currentArray.push(trimmed.slice(2).trim());
      continue;
    }

    // Save previous array if any
    if (currentKey && currentArray) {
      (result as Record<string, unknown>)[currentKey] = currentArray;
      currentArray = null;
      currentKey = null;
    }

    // Parse key: value
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();

    if (!value) {
      // Start of array
      currentKey = key;
      currentArray = [];
    } else {
      // Single value
      let parsedValue: string | number | boolean = value;

      // Remove quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        parsedValue = value.slice(1, -1);
      } else if (value === "true") {
        parsedValue = true;
      } else if (value === "false") {
        parsedValue = false;
      } else if (!isNaN(Number(value))) {
        parsedValue = Number(value);
      }

      (result as Record<string, unknown>)[key] = parsedValue;
    }
  }

  // Save final array if any
  if (currentKey && currentArray) {
    (result as Record<string, unknown>)[currentKey] = currentArray;
  }

  return result;
}

/**
 * Group array items by a key function
 */
function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

/**
 * Serialize a single steward to config format
 */
function serializeSteward(
  steward: ContextSteward,
  userEmails: Record<string, string>
): SerializedSteward {
  const result: SerializedSteward = {
    email: userEmails[steward.stewardUserId] || steward.stewardUserId,
    can_approve: steward.canApprove,
  };

  if (steward.canReject) result.can_reject = true;
  if (steward.canDelegate) result.can_delegate = true;

  return result;
}
