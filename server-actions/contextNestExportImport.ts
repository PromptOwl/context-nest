"use server";

/**
 * Context Nest Export/Import Server Actions
 *
 * Server-side actions for exporting Context Nest to portable files
 * and importing from Obsidian vaults or other Context Nest exports.
 */

import connectDb from "@/db/connectDb";
import { authenticatedUser } from "../data-access/helper";
import DataRoomDocument from "@/db/models/dataRoomDocument";
import DataRoomFolder from "@/db/models/dataRoomFolder";
import ContextStewardModel from "@/db/models/contextSteward";
import DataRoom from "@/db/models/dataRoom";
import User from "@/db/models/user";
import {
  exportContextNest,
  importContextNest,
  importFromObsidian,
  type ExportResult,
  type ImportResult,
} from "@/lib/context-nest";

// ============================================================================
// Export Actions
// ============================================================================

export interface ExportContextNestParams {
  dataRoomId: string;
  includeVersionHistory?: boolean;
}

export interface ExportContextNestResult {
  success: boolean;
  data?: {
    files: Array<{ path: string; content: string }>;
    rootFolderName: string;
    stats: {
      totalDocuments: number;
      totalFolders: number;
      totalStewards: number;
    };
  };
  error?: string;
}

/**
 * Export a data room as a Context Nest (returns file contents for client-side ZIP creation)
 */
export async function exportDataRoomAsContextNest(
  params: ExportContextNestParams
): Promise<ExportContextNestResult> {
  try {
    await connectDb();
    const user = await authenticatedUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { dataRoomId, includeVersionHistory = false } = params;

    // Verify user has access to data room
    const dataRoom = await DataRoom.findOne({
      _id: dataRoomId,
      $or: [
        { owner: user.id }
      ],
    });

    if (!dataRoom) {
      return { success: false, error: "Data room not found or access denied" };
    }

    // Fetch all data in parallel for better performance
    // When version history is not needed, exclude the versions array to reduce memory usage
    const documentQuery = DataRoomDocument.find({ dataRoom: dataRoomId });
    if (!includeVersionHistory) {
      documentQuery.select('-versions');
    } 

    const [documents, folders, stewards] = await Promise.all([
      documentQuery.lean(),
      DataRoomFolder.find({ dataRoom: dataRoomId }).lean(),
      ContextStewardModel.find({
        dataRoom: dataRoomId,
        isActive: true,
      }).lean(),
    ]);

    // Build user email mapping - collect all unique user IDs
    const userIds = new Set<string>();
    for (const d of documents as any[]) {
      if (d.owner) userIds.add(d.owner.toString());
      if (d.approvedBy) userIds.add(d.approvedBy.toString());
      if (includeVersionHistory && d.versions && Array.isArray(d.versions)) {
        for (const v of d.versions) {
          if (v.editedBy) userIds.add(v.editedBy.toString());
        }
      }
    }
    for (const s of stewards as any[]) {
      userIds.add(s.stewardUserId.toString());
      userIds.add(s.assignedBy.toString());
    }

    const userIdArray = Array.from(userIds);
    // Only fetch required fields from users
    const users = await User.find({ _id: { $in: userIdArray } })
      .select('_id email')
      .lean();
    const userEmails: Record<string, string> = {};
    users.forEach((u: any) => {
      userEmails[u._id.toString()] = u.email;
    });

    // Convert to Context Nest types (map MongoDB field names to spec field names)
    const contextDocuments = documents.map((d: any) => ({
      id: d._id.toString(),
      title: d.title,
      content: d.content,
      dataRoomId: d.dataRoom.toString(),
      folderId: d.folder?.toString(),
      ownerId: d.owner?.toString() || "",
      tags: d.tags || [],
      wikiLinks: (d.wikiLinks || []).map((w: any) => ({
        text: w.text,
        displayText: w.displayText,
        targetId: w.targetId?.toString() || null,
        targetTitle: w.targetTitle,
      })),
      mentions: (d.mentions || []).map((m: any) => ({
        type: m.type,
        name: m.name,
        id: m.id?.toString(),
      })),
      tasks: (d.tasks || []).map((t: any) => ({
        id: t.id,
        text: t.text,
        completed: t.completed,
        assigneeId: t.assigneeId?.toString() || null,
        assigneeName: t.assigneeName,
      })),
      backlinks: (d.backlinks || []).map((b: any) => b.toString()),
      version: d.version || 1,
      versions: (d.versions || []).map((v: any) => ({
        version: v.version,
        content: v.content,
        editedBy: v.editedBy?.toString() || "",
        editedAt: v.editedAt || new Date(),
        changeNote: v.changeNote,
      })),
      lockedBy: d.lockedBy?.toString(),
      lockedAt: d.lockedAt,
      lockExpiresAt: d.lockExpiresAt,
      lifecycleStatus: d.lifecycleStatus || "draft",
      approvedVersion: d.approvedVersion ?? null,
      approvedAt: d.approvedAt,
      approvedBy: d.approvedBy?.toString(),
      reviewRequestedAt: d.reviewRequestedAt,
      reviewRequestedBy: d.reviewRequestedBy?.toString(),
      reviewNote: d.reviewNote,
      createdAt: d.createdAt || new Date(),
      updatedAt: d.updatedAt || new Date(),
    }));

    const contextFolders = folders.map((f: any) => ({
      id: f._id.toString(),
      name: f.name,
      path: f.path || f.name.toLowerCase().replace(/\s+/g, "-"),
      parentId: f.parent?.toString(),
      description: f.description,
    }));

    const contextStewards = stewards.map((s: any) => ({
      id: s._id.toString(),
      dataRoomId: s.dataRoom.toString(),
      scope: s.scope,
      documentId: s.documentId?.toString(),
      folderId: s.folderId?.toString(),
      tagName: s.tagName,
      stewardUserId: s.stewardUserId.toString(),
      canApprove: s.canApprove,
      canReject: s.canReject,
      canDelegate: s.canDelegate,
      assignedBy: s.assignedBy.toString(),
      assignedAt: s.assignedAt || new Date(),
      isActive: s.isActive,
    }));

    // Export
    const result = await exportContextNest({
      dataRoomId,
      dataRoomName: dataRoom.name,
      description: dataRoom.description,
      documents: contextDocuments,
      stewards: contextStewards,
      folders: contextFolders,
      userEmails,
      includeVersionHistory,
    });

    return {
      success: true,
      data: {
        files: result.files,
        rootFolderName: dataRoom.name.toLowerCase().replace(/\s+/g, "-"),
        stats: result.stats,
      },
    };
  } catch (error) {
    console.error("Error exporting Context Nest:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Import Actions
// ============================================================================

export interface ImportContextNestParams {
  dataRoomId: string;
  files: Array<{ path: string; content: string }>;
  skipExisting?: boolean;
  createFolders?: boolean;
}

export interface ImportContextNestResult {
  success: boolean;
  data?: {
    documentsImported: number;
    documentsSkipped: number;
    foldersCreated: number;
    stewardsImported: number;
    errors: Array<{ file: string; error: string }>;
  };
  error?: string;
}

/**
 * Import a Context Nest into a data room
 */
export async function importContextNestToDataRoom(
  params: ImportContextNestParams
): Promise<ImportContextNestResult> {
  try {
    await connectDb();
    const user = await authenticatedUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { dataRoomId, files, skipExisting = true, createFolders = true } = params;

    // Verify user has write access to data room
    const dataRoom = await DataRoom.findOne({
      _id: dataRoomId,
      $or: [
        { owner: user.id }
      ],
    });

    if (!dataRoom) {
      return { success: false, error: "Data room not found or access denied" };
    }

    // Get existing documents to check for duplicates
    const existingDocs = await DataRoomDocument.find({ dataRoom: dataRoomId }).select("title").lean();
    const existingTitles = new Set(existingDocs.map((d: any) => d.title));

    // Get existing folders
    const existingFolders = await DataRoomFolder.find({ dataRoom: dataRoomId }).lean();
    const folderIds: Record<string, string> = {};
    existingFolders.forEach((f: any) => {
      const path = f.path || f.name.toLowerCase().replace(/\s+/g, "-");
      folderIds[path] = f._id.toString();
    });

    // Build user ID mapping from emails
    const userIds: Record<string, string> = {};
    const allUsers = await User.find({}).select("_id email").lean();
    allUsers.forEach((u: any) => {
      userIds[u.email.toLowerCase()] = u._id.toString();
    });

    // Create a set of valid user IDs for validation
    const validUserIds = new Set(Object.values(userIds));

    // Create folders from import paths if needed
    let foldersCreated = 0;
    if (createFolders) {
      const folderPaths: string[] = [];
      files.forEach((f) => {
        if (f.path.endsWith(".md") && !f.path.includes(".context/") && !f.path.includes(".versions/")) {
          const parts = f.path.split("/");
          parts.pop(); // Remove filename
          if (parts.length > 0) {
            // Add all parent paths
            for (let i = 1; i <= parts.length; i++) {
              const p = parts.slice(0, i).join("/");
              if (!folderPaths.includes(p)) folderPaths.push(p);
            }
          }
        }
      });

      for (const path of folderPaths) {
        if (!folderIds[path]) {
          const parts = path.split("/");
          const name = parts[parts.length - 1];
          const parentPath = parts.slice(0, -1).join("/");

          const folder = await DataRoomFolder.create({
            dataRoom: dataRoomId,
            name: name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " "),
            path,
            parent: parentPath ? folderIds[parentPath] : undefined,
            owner: user.id,
          });

          folderIds[path] = folder._id.toString();
          foldersCreated++;
        }
      }
    }

    // Import documents
    const importResult = await importContextNest({
      files,
      dataRoomId,
      userIds,
      folderIds,
      skipExisting,
      existingTitles,
    });

    // Create documents in database using bulk insertion (map spec field names to MongoDB field names)
    const docsToInsert = importResult.documents.map((doc) => {
      // Filter mentions to only include those with resolved IDs
      // Mentions from markdown like @john.doe don't have IDs until resolved
      const validMentions = (doc.mentions || []).filter((m: any) => m.id);

      // Filter tasks to ensure they have valid structure
      const validTasks = (doc.tasks || []).map((t: any) => ({
        id: t.id,
        text: t.text,
        completed: t.completed || false,
        assigneeId: t.assigneeId || null,
        assigneeName: t.assigneeName || null,
      }));

      return {
        title: doc.title,
        content: doc.content,
        dataRoom: doc.dataRoomId,
        folder: doc.folderId,
        owner: doc.ownerId && validUserIds.has(doc.ownerId) ? doc.ownerId : user.id,
        tags: doc.tags,
        wikiLinks: doc.wikiLinks || [],
        mentions: validMentions,
        tasks: validTasks,
        backlinks: doc.backlinks || [],
        version: doc.version || 1,
        versions: doc.versions || [],
        lifecycleStatus: doc.lifecycleStatus || "draft",
        approvedVersion: doc.approvedVersion,
        approvedAt: doc.approvedAt,
        approvedBy: doc.approvedBy && validUserIds.has(doc.approvedBy) ? doc.approvedBy : undefined,
      };
    });

    if (docsToInsert.length > 0) {
      await DataRoomDocument.insertMany(docsToInsert);
    }

    // Create stewards from imported config
    let stewardsCreated = 0;
    if (importResult.stewards.length > 0) {
      // Build document title -> ID mapping from newly created docs
      const createdDocs = await DataRoomDocument.find({ dataRoom: dataRoomId })
        .select("_id title")
        .lean();
      const docIdsByTitle: Record<string, string> = {};
      createdDocs.forEach((d: any) => {
        docIdsByTitle[d.title] = d._id.toString();
      });

      for (const steward of importResult.stewards) {
        try {
          // Validate steward user ID exists in system
          if (!validUserIds.has(steward.stewardUserId)) {
            importResult.errors.push({
              file: 'stewards',
              error: `Skipped steward: User ID ${steward.stewardUserId} not found in system`
            });
            continue;
          }

          // Resolve document ID if this is a document-level steward
          if (steward.scope === "document" && !steward.documentId) {
            // Skip if we can't resolve document
            continue;
          }

          await ContextStewardModel.create({
            dataRoom: dataRoomId,
            scope: steward.scope,
            documentId: steward.documentId,
            folderId: steward.folderId,
            tagName: steward.tagName,
            stewardUserId: steward.stewardUserId,
            canApprove: steward.canApprove,
            canReject: steward.canReject,
            canDelegate: steward.canDelegate,
            assignedBy: user.id,
            assignedAt: new Date(),
            isActive: true,
          });
          stewardsCreated++;
        } catch (e) {
          // Skip duplicates or invalid stewards
          console.log("Skipped steward:", e);
          importResult.errors.push({
            file: 'stewards',
            error: `Failed to create steward: ${e instanceof Error ? e.message : 'Unknown error'}`
          });
        }
      }
    }

    return {
      success: true,
      data: {
        documentsImported: importResult.stats.documentsImported,
        documentsSkipped: importResult.stats.documentsSkipped,
        foldersCreated,
        stewardsImported: stewardsCreated,
        errors: importResult.errors,
      },
    };
  } catch (error) {
    console.error("Error importing Context Nest:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Import from an Obsidian vault
 */
export async function importObsidianVault(params: {
  dataRoomId: string;
  files: Array<{ path: string; content: string }>;
}): Promise<ImportContextNestResult> {
  try {
    await connectDb();
    const user = await authenticatedUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { dataRoomId, files } = params;

    // Verify user has write access
    const dataRoom = await DataRoom.findOne({
      _id: dataRoomId,
      $or: [
        { owner: user.id },
      ],
    });

    if (!dataRoom) {
      return { success: false, error: "Data room not found or access denied" };
    }

    // Import using Obsidian-specific parser
    const importResult = await importFromObsidian({
      files,
      dataRoomId,
      defaultOwnerId: user.id.toString(),
    });

    // Create documents using bulk insertion for better performance
    if (importResult.documents.length > 0) {
      const docsToInsert = importResult.documents.map((doc) => {
        // Filter mentions to only include those with resolved IDs
        const validMentions = (doc.mentions || []).filter((m: any) => m.id);

        // Filter tasks to ensure they have valid structure
        const validTasks = (doc.tasks || []).map((t: any) => ({
          id: t.id,
          text: t.text,
          completed: t.completed || false,
          assigneeId: t.assigneeId || null,
          assigneeName: t.assigneeName || null,
        }));

        return {
          title: doc.title,
          content: doc.content,
          dataRoom: doc.dataRoomId,
          folder: doc.folderId,
          owner: doc.ownerId || user.id,
          tags: doc.tags,
          wikiLinks: doc.wikiLinks || [],
          mentions: validMentions,
          tasks: validTasks,
          backlinks: doc.backlinks || [],
          version: doc.version || 1,
          versions: doc.versions || [],
          lifecycleStatus: doc.lifecycleStatus || "draft",
          approvedVersion: doc.approvedVersion,
        };
      });

      await DataRoomDocument.insertMany(docsToInsert);
    }

    return {
      success: true,
      data: {
        documentsImported: importResult.stats.documentsImported,
        documentsSkipped: importResult.stats.documentsSkipped,
        foldersCreated: 0,
        stewardsImported: 0,
        errors: importResult.errors,
      },
    };
  } catch (error) {
    console.error("Error importing Obsidian vault:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
