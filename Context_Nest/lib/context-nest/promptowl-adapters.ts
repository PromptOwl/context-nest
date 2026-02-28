/**
 * Context Nest - PromptOwl Adapters
 *
 * These are the concrete implementations of Context Nest adapters
 * that integrate with PromptOwl's existing infrastructure.
 */

import type {
  AuthAdapter,
  DocumentStorageAdapter,
  StewardshipStorageAdapter,
  TagStorageAdapter,
  UserLookupAdapter,
  VectorStoreAdapter,
  NotificationAdapter,
  ContextNestConfig,
} from "./adapters";
import type {
  ContextDocument,
  ContextSteward,
  ReviewRequest,
  UserRef,
  DocumentSearchResult,
  TagSearchResult,
  MentionSearchResult,
} from "./types";

/**
 * PromptOwl Authentication Adapter
 * Wraps NextAuth session and user authentication
 */
export function createPromptOwlAuthAdapter(): AuthAdapter {
  return {
    async getCurrentUser(): Promise<UserRef | null> {
      const { authenticatedUser } = await import("@/app/data-access/helper");
      const user = await authenticatedUser();
      if (!user?.id) return null;
      return {
        id: user.id,
        email: user.email || "",
        name: user.name || undefined,
        image: user.image || undefined,
      };
    },

    async hasDataRoomAccess(dataRoomId: string): Promise<boolean> {
      const { authenticatedUser } = await import("@/app/data-access/helper");
      const connectDb = (await import("@/db/connectDb")).default;
      const DataRoom = (await import("@/db/models/dataRoom")).default;

      await connectDb();
      const user = await authenticatedUser();
      if (!user?.id) return false;

      const dataRoom = await DataRoom.findById(dataRoomId).lean() as { owner?: any } | null;
      if (!dataRoom) return false;

      // Check if user is owner
      return dataRoom.owner?.toString() === user.id;
    },
  };
}

/**
 * PromptOwl Document Storage Adapter
 * Wraps the existing DataRoomDocument model and actions
 */
export function createPromptOwlDocumentAdapter(): DocumentStorageAdapter {
  return {
    async createDocument(data) {
      const { createDataRoomDocument } = await import("@/app/actions/dataRoomDocuments");
      const result = await createDataRoomDocument({
        title: data.title,
        content: data.content,
        dataRoomId: data.dataRoomId,
        folderId: data.folderId,
        tags: data.tags,
      });
      if (!result.success) throw new Error(result.error);
      return mapDocumentFromDb(result.document);
    },

    async getDocument(id) {
      const { getDataRoomDocument } = await import("@/app/actions/dataRoomDocuments");
      const result = await getDataRoomDocument(id);
      if (!result.success || !result.document) return null;
      return mapDocumentFromDb(result.document);
    },

    async updateDocument(id, data) {
      const { updateDataRoomDocument } = await import("@/app/actions/dataRoomDocuments");
      const result = await updateDataRoomDocument(id, {
        title: data.title,
        content: data.content,
        tags: data.tags,
      });
      if (!result.success) throw new Error(result.error);
      return mapDocumentFromDb(result.document);
    },

    async deleteDocument(id) {
      const { deleteDataRoomDocument } = await import("@/app/actions/dataRoomDocuments");
      const result = await deleteDataRoomDocument(id);
      if (!result.success) throw new Error(result.error);
    },

    async listDocuments(params) {
      const { listDataRoomDocuments } = await import("@/app/actions/dataRoomDocuments");
      const result = await listDataRoomDocuments({
        dataRoomId: params.dataRoomId,
        folderId: params.folderId,
        tags: params.tags,
        lifecycleStatus: params.lifecycleStatus,
        search: params.search,
      });
      if (!result.success) return { documents: [], total: 0 };
      return {
        documents: (result.documents || []).map(mapDocumentFromDb),
        total: result.documents?.length || 0,
      };
    },

    async searchDocuments(query, dataRoomId, limit = 10) {
      const connectDb = (await import("@/db/connectDb")).default;
      const DataRoomDocument = (await import("@/db/models/dataRoomDocument")).default;
      const { authenticatedUser } = await import("@/app/data-access/helper");
      const mongoose = (await import("mongoose")).default;

      await connectDb();
      const user = await authenticatedUser();
      if (!user?.id) return [];

      const searchQuery: Record<string, unknown> = {
        $or: [
          { owner: new mongoose.Types.ObjectId(user.id) },
          { "sharedWith.email": user.email },
        ],
      };

      if (dataRoomId) {
        searchQuery.dataRoom = new mongoose.Types.ObjectId(dataRoomId);
      }

      if (query) {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        searchQuery.title = { $regex: new RegExp(escaped, "i") };
      }

      const docs = await DataRoomDocument.find(searchQuery)
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select("title tags updatedAt")
        .lean();

      return docs.map((doc: any) => ({
        id: doc._id.toString(),
        title: doc.title,
        tags: doc.tags || [],
        updatedAt: doc.updatedAt,
      }));
    },

    async findDocumentByTitle(title, dataRoomId) {
      const connectDb = (await import("@/db/connectDb")).default;
      const DataRoomDocument = (await import("@/db/models/dataRoomDocument")).default;
      const mongoose = (await import("mongoose")).default;

      await connectDb();
      const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const doc = await DataRoomDocument.findOne({
        title: { $regex: new RegExp(`^${escaped}$`, "i") },
        dataRoom: new mongoose.Types.ObjectId(dataRoomId),
      })
        .select("_id title")
        .lean();

      if (!doc) return null;
      return { id: (doc as any)._id.toString(), title: (doc as any).title };
    },

    async getDocumentsLinkingTo(documentId) {
      const { getDocumentBacklinks } = await import("@/app/actions/dataRoomDocuments");
      const result = await getDocumentBacklinks(documentId);
      if (!result.success) return [];
      return (result.backlinks || []).map((b: any) => ({
        id: b._id,
        title: b.title,
      }));
    },

    async addBacklink(targetDocId, sourceDocId) {
      const connectDb = (await import("@/db/connectDb")).default;
      const DataRoomDocument = (await import("@/db/models/dataRoomDocument")).default;
      const mongoose = (await import("mongoose")).default;

      await connectDb();
      await DataRoomDocument.updateOne(
        { _id: new mongoose.Types.ObjectId(targetDocId) },
        { $addToSet: { backlinks: new mongoose.Types.ObjectId(sourceDocId) } }
      );
    },

    async removeBacklink(targetDocId, sourceDocId) {
      const connectDb = (await import("@/db/connectDb")).default;
      const DataRoomDocument = (await import("@/db/models/dataRoomDocument")).default;
      const mongoose = (await import("mongoose")).default;

      await connectDb();
      await DataRoomDocument.updateOne(
        { _id: new mongoose.Types.ObjectId(targetDocId) },
        { $pull: { backlinks: new mongoose.Types.ObjectId(sourceDocId) } }
      );
    },
  };
}

/**
 * PromptOwl Stewardship Storage Adapter
 */
export function createPromptOwlStewardshipAdapter(): StewardshipStorageAdapter {
  return {
    async assignSteward(data) {
      const { assignSteward } = await import("@/app/actions/contextStewardship");
      const result = await assignSteward({
        dataRoomId: data.dataRoomId,
        scope: data.scope,
        scopeTarget: data.documentId || data.folderId || data.tagName,
        stewardUserId: data.stewardUserId,
        permissions: {
          canApprove: data.canApprove,
          canReject: data.canReject,
          canDelegate: data.canDelegate,
        },
      });
      if (!result.success) throw new Error(result.error);
      return mapStewardFromDb(result.steward);
    },

    async removeSteward(id) {
      const { removeSteward } = await import("@/app/actions/contextStewardship");
      const result = await removeSteward(id);
      if (!result.success) throw new Error(result.error);
    },

    async getSteward(id) {
      const connectDb = (await import("@/db/connectDb")).default;
      const ContextSteward = (await import("@/db/models/contextSteward")).default;

      await connectDb();
      const steward = await ContextSteward.findById(id).lean();
      if (!steward) return null;
      return mapStewardFromDb(steward);
    },

    async getStewardsForScope(params) {
      const { getStewardsForScope } = await import("@/app/actions/contextStewardship");
      const result = await getStewardsForScope({
        ...params,
        scope: params.scope || "dataRoom",
      });
      if (!result.success) return [];
      return (result.stewards || []).map(mapStewardFromDb);
    },

    async getStewardsForUser(userId) {
      const { getMyAssignedScopes } = await import("@/app/actions/contextStewardship");
      const result = await getMyAssignedScopes();
      if (!result.success) return [];
      return (result.stewardships || []).map(mapStewardFromDb);
    },

    async resolveStewardsForDocument(documentId) {
      const { resolveStewardsForDocument } = await import("@/app/actions/contextStewardship");
      const result = await resolveStewardsForDocument(documentId);
      if (!result.success) return [];
      return (result.stewards || []).map(mapStewardFromDb);
    },

    async createReviewRequest(data) {
      const { submitForReview } = await import("@/app/actions/documentLifecycle");
      const result = await submitForReview(data.documentId, data.requestNote, data.priority);
      if (!result.success) throw new Error(result.error);
      return mapReviewRequestFromDb(result.reviewRequest);
    },

    async getReviewRequest(id) {
      const connectDb = (await import("@/db/connectDb")).default;
      const ReviewRequest = (await import("@/db/models/reviewRequest")).default;

      await connectDb();
      const request = await ReviewRequest.findById(id).lean();
      if (!request) return null;
      return mapReviewRequestFromDb(request);
    },

    async updateReviewRequest(id, data) {
      const connectDb = (await import("@/db/connectDb")).default;
      const ReviewRequest = (await import("@/db/models/reviewRequest")).default;

      await connectDb();
      const request = await ReviewRequest.findByIdAndUpdate(id, data, { new: true }).lean();
      if (!request) throw new Error("Review request not found");
      return mapReviewRequestFromDb(request);
    },

    async getReviewQueue(params) {
      const { getReviewQueue, getMyReviewQueue } = await import("@/app/actions/documentLifecycle");

      if (params.stewardUserId) {
        const result = await getMyReviewQueue(params.dataRoomId);
        if (!result.success) return { requests: [], total: 0 };
        return {
          requests: (result.requests || []).map(mapReviewRequestFromDb),
          total: result.total || 0,
        };
      }

      const result = await getReviewQueue({
        dataRoomId: params.dataRoomId!,
        status: params.status,
        limit: params.limit,
        offset: params.offset,
      });
      if (!result.success) return { requests: [], total: 0 };
      return {
        requests: (result.requests || []).map(mapReviewRequestFromDb),
        total: result.total || 0,
      };
    },
  };
}

/**
 * PromptOwl Tag Storage Adapter
 */
export function createPromptOwlTagAdapter(): TagStorageAdapter {
  return {
    async searchTags(query, dataRoomId, limit = 20) {
      // Use the existing API route logic
      const connectDb = (await import("@/db/connectDb")).default;
      const DataRoomDocument = (await import("@/db/models/dataRoomDocument")).default;
      const { authenticatedUser } = await import("@/app/data-access/helper");
      const mongoose = (await import("mongoose")).default;

      await connectDb();
      const user = await authenticatedUser();
      if (!user?.id) return [];

      // Aggregate tags from documents
      const pipeline: any[] = [
        {
          $match: {
            dataRoom: new mongoose.Types.ObjectId(dataRoomId),
            $or: [
              { owner: new mongoose.Types.ObjectId(user.id) },
              { "sharedWith.email": user.email },
            ],
          },
        },
        { $unwind: "$tags" },
        {
          $match: query
            ? { tags: { $regex: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } }
            : {},
        },
        {
          $group: {
            _id: "$tags",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: limit },
      ];

      const results = await DataRoomDocument.aggregate(pipeline);
      return results.map((r: any) => ({
        name: r._id,
        documentCount: r.count,
      }));
    },

    async getTagsForDataRoom(dataRoomId) {
      return this.searchTags("", dataRoomId, 100);
    },
  };
}

/**
 * PromptOwl User Lookup Adapter
 */
export function createPromptOwlUserAdapter(): UserLookupAdapter {
  return {
    async searchMentions(query, dataRoomId, limit = 10) {
      // Use existing mentions search API logic
      const connectDb = (await import("@/db/connectDb")).default;
      const User = (await import("@/db/models/user")).default;
      const Team = (await import("@/db/models/team")).default;
      const { authenticatedUser } = await import("@/app/data-access/helper");

      await connectDb();
      const user = await authenticatedUser();
      if (!user?.id) return [];

      const results: MentionSearchResult[] = [];
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // Search users
      const users = await User.find({
        $or: [
          { name: { $regex: escaped, $options: "i" } },
          { email: { $regex: escaped, $options: "i" } },
        ],
      })
        .limit(limit)
        .select("_id name email")
        .lean();

      for (const u of users as any[]) {
        results.push({
          id: u._id.toString(),
          name: u.name || u.email,
          email: u.email,
          type: "user",
        });
      }

      // Search teams
      const teams = await Team.find({
        name: { $regex: escaped, $options: "i" },
        $or: [{ userId: user.id }, { "members.userId": user.id }],
      })
        .limit(limit)
        .select("_id name")
        .lean();

      for (const t of teams as any[]) {
        results.push({
          id: t._id.toString(),
          name: t.name,
          type: "team",
        });
      }

      return results.slice(0, limit);
    },

    async getUser(userId) {
      const connectDb = (await import("@/db/connectDb")).default;
      const User = (await import("@/db/models/user")).default;

      await connectDb();
      const user = await User.findById(userId).select("_id name email image").lean() as any;
      if (!user) return null;
      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },

    async getUsers(userIds) {
      const connectDb = (await import("@/db/connectDb")).default;
      const User = (await import("@/db/models/user")).default;
      const mongoose = (await import("mongoose")).default;

      await connectDb();
      const users = await User.find({
        _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select("_id name email image")
        .lean();

      return (users as any[]).map((u) => ({
        id: u._id.toString(),
        email: u.email,
        name: u.name,
        image: u.image,
      }));
    },

    async getDataRoomTeam(dataRoomId) {
      const { getDataRoomTeam } = await import("@/app/actions/dataRoomTeam");
      const result = await getDataRoomTeam(dataRoomId);
      if (!result.success) return [];
      return (result.members || []).map((m: any) => ({
        id: m.userId,
        email: m.email,
        name: m.name,
        image: m.image,
      }));
    },
  };
}

// Mapping helpers
function mapDocumentFromDb(doc: any): ContextDocument {
  return {
    id: doc._id?.toString() || doc.id,
    title: doc.title,
    content: doc.content,
    dataRoomId: doc.dataRoom?.toString() || doc.dataRoomId,
    folderId: doc.folder?.toString() || doc.folderId,
    ownerId: doc.owner?.toString() || doc.ownerId,
    tags: doc.tags || [],
    wikiLinks: (doc.wikiLinks || []).map((l: any) => ({
      text: l.text,
      displayText: l.displayText,
      targetId: l.targetId?.toString() || null,
      targetTitle: l.targetTitle || l.text,
    })),
    mentions: doc.mentions || [],
    tasks: doc.tasks || [],
    backlinks: (doc.backlinks || []).map((b: any) => b?.toString() || b),
    version: doc.version || 1,
    versions: doc.versions || [],
    lockedBy: doc.lockedBy?.toString(),
    lockedAt: doc.lockedAt,
    lockExpiresAt: doc.lockExpiresAt,
    lifecycleStatus: doc.lifecycleStatus || "draft",
    approvedVersion: doc.approvedVersion,
    approvedAt: doc.approvedAt,
    approvedBy: doc.approvedBy?.toString(),
    reviewRequestedAt: doc.reviewRequestedAt,
    reviewRequestedBy: doc.reviewRequestedBy?.toString(),
    reviewNote: doc.reviewNote,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function mapStewardFromDb(steward: any): ContextSteward {
  return {
    id: steward._id?.toString() || steward.id,
    dataRoomId: steward.dataRoom?.toString() || steward.dataRoomId,
    scope: steward.scope,
    documentId: steward.documentId?.toString(),
    folderId: steward.folderId?.toString(),
    tagName: steward.tagName,
    stewardUserId: steward.stewardUserId?.toString() || steward.stewardUser?._id?.toString(),
    canApprove: steward.canApprove ?? true,
    canReject: steward.canReject ?? true,
    canDelegate: steward.canDelegate ?? false,
    assignedBy: steward.assignedBy?.toString(),
    assignedAt: steward.assignedAt,
    isActive: steward.isActive ?? true,
  };
}

function mapReviewRequestFromDb(request: any): ReviewRequest {
  return {
    id: request._id?.toString() || request.id,
    dataRoomId: request.dataRoom?.toString() || request.dataRoomId,
    documentId: request.document?.toString() || request.document?._id?.toString() || request.documentId,
    version: request.version,
    requestedBy: request.requestedBy?.toString() || request.requestedBy?._id?.toString(),
    requestedAt: request.requestedAt,
    requestNote: request.requestNote,
    status: request.status,
    resolvedBy: request.resolvedBy?.toString() || request.resolvedBy?._id?.toString(),
    resolvedAt: request.resolvedAt,
    resolutionNote: request.resolutionNote,
    priority: request.priority || "normal",
  };
}

/**
 * Create the full PromptOwl Context Nest configuration
 */
export function createPromptOwlContextNestConfig(): ContextNestConfig {
  return {
    auth: createPromptOwlAuthAdapter(),
    documents: createPromptOwlDocumentAdapter(),
    stewardship: createPromptOwlStewardshipAdapter(),
    tags: createPromptOwlTagAdapter(),
    users: createPromptOwlUserAdapter(),
    features: {
      documentLocking: true,
      lockDurationMs: 30 * 60 * 1000, // 30 minutes
      stewardship: true,
      vectorIndexing: false, // Not yet implemented
      notifications: false, // Not yet implemented
    },
  };
}
