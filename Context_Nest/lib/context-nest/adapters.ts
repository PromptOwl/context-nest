/**
 * Context Nest - Adapter Interfaces
 *
 * These interfaces define the external dependencies that Context Nest needs.
 * By implementing these adapters, Context Nest can run in different environments
 * (standalone, embedded in PromptOwl, etc.)
 */

import type {
  ContextDocument,
  ContextSteward,
  ReviewRequest,
  UserRef,
  DocumentSearchResult,
  TagSearchResult,
  MentionSearchResult,
  DocumentLifecycleStatus,
  StewardshipScope,
  ReviewRequestPriority,
} from "./types";

/**
 * Authentication adapter - provides current user context
 */
export interface AuthAdapter {
  /**
   * Get the current authenticated user
   * @returns User reference or null if not authenticated
   */
  getCurrentUser(): Promise<UserRef | null>;

  /**
   * Check if the current user has access to a data room
   */
  hasDataRoomAccess(dataRoomId: string): Promise<boolean>;
}

/**
 * Document storage adapter - CRUD operations for documents
 */
export interface DocumentStorageAdapter {
  // Document CRUD
  createDocument(data: Omit<ContextDocument, "id" | "createdAt" | "updatedAt">): Promise<ContextDocument>;
  getDocument(id: string): Promise<ContextDocument | null>;
  updateDocument(id: string, data: Partial<ContextDocument>): Promise<ContextDocument>;
  deleteDocument(id: string): Promise<void>;

  // Document queries
  listDocuments(params: {
    dataRoomId: string;
    folderId?: string;
    tags?: string[];
    lifecycleStatus?: DocumentLifecycleStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ documents: ContextDocument[]; total: number }>;

  // Search
  searchDocuments(query: string, dataRoomId?: string, limit?: number): Promise<DocumentSearchResult[]>;

  // Wiki link resolution
  findDocumentByTitle(title: string, dataRoomId: string): Promise<{ id: string; title: string } | null>;

  // Backlinks
  getDocumentsLinkingTo(documentId: string): Promise<Array<{ id: string; title: string }>>;
  addBacklink(targetDocId: string, sourceDocId: string): Promise<void>;
  removeBacklink(targetDocId: string, sourceDocId: string): Promise<void>;
}

/**
 * Stewardship storage adapter - steward assignments and review requests
 */
export interface StewardshipStorageAdapter {
  // Steward management
  assignSteward(data: Omit<ContextSteward, "id">): Promise<ContextSteward>;
  removeSteward(id: string): Promise<void>;
  getSteward(id: string): Promise<ContextSteward | null>;

  // Steward queries
  getStewardsForScope(params: {
    dataRoomId: string;
    scope?: StewardshipScope;
    scopeTarget?: string;
  }): Promise<ContextSteward[]>;

  getStewardsForUser(userId: string): Promise<ContextSteward[]>;

  // Steward resolution (find who can approve a document)
  resolveStewardsForDocument(documentId: string): Promise<ContextSteward[]>;

  // Review requests
  createReviewRequest(data: Omit<ReviewRequest, "id">): Promise<ReviewRequest>;
  getReviewRequest(id: string): Promise<ReviewRequest | null>;
  updateReviewRequest(id: string, data: Partial<ReviewRequest>): Promise<ReviewRequest>;

  // Review queue
  getReviewQueue(params: {
    dataRoomId?: string;
    status?: ReviewRequest["status"] | ReviewRequest["status"][];
    stewardUserId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ requests: ReviewRequest[]; total: number }>;
}

/**
 * Tag storage adapter - tag management
 */
export interface TagStorageAdapter {
  searchTags(query: string, dataRoomId: string, limit?: number): Promise<TagSearchResult[]>;
  getTagsForDataRoom(dataRoomId: string): Promise<TagSearchResult[]>;
}

/**
 * User lookup adapter - find users for mentions, sharing, etc.
 */
export interface UserLookupAdapter {
  /**
   * Search for users/teams that can be mentioned
   */
  searchMentions(query: string, dataRoomId: string, limit?: number): Promise<MentionSearchResult[]>;

  /**
   * Get user details by ID
   */
  getUser(userId: string): Promise<UserRef | null>;

  /**
   * Get multiple users by IDs
   */
  getUsers(userIds: string[]): Promise<UserRef[]>;

  /**
   * Get team members for a data room
   */
  getDataRoomTeam(dataRoomId: string): Promise<UserRef[]>;
}

/**
 * Optional: Vector store adapter for AI context integration
 */
export interface VectorStoreAdapter {
  /**
   * Index a document's content for semantic search
   */
  indexDocument(documentId: string, content: string, metadata: Record<string, unknown>): Promise<void>;

  /**
   * Remove a document from the index
   */
  removeDocument(documentId: string): Promise<void>;

  /**
   * Search for relevant documents
   */
  search(query: string, dataRoomId: string, limit?: number): Promise<Array<{ id: string; score: number }>>;
}

/**
 * Optional: Notification adapter for emails, webhooks, etc.
 */
export interface NotificationAdapter {
  /**
   * Notify user of a share
   */
  notifyShare(recipientEmail: string, document: ContextDocument, sharedBy: UserRef): Promise<void>;

  /**
   * Notify steward of new review request
   */
  notifyReviewRequest(steward: UserRef, request: ReviewRequest, document: ContextDocument): Promise<void>;

  /**
   * Notify author of review decision
   */
  notifyReviewDecision(author: UserRef, request: ReviewRequest, document: ContextDocument): Promise<void>;
}

/**
 * Context Nest configuration
 */
export interface ContextNestConfig {
  // Required adapters
  auth: AuthAdapter;
  documents: DocumentStorageAdapter;
  stewardship: StewardshipStorageAdapter;
  tags: TagStorageAdapter;
  users: UserLookupAdapter;

  // Optional adapters
  vectorStore?: VectorStoreAdapter;
  notifications?: NotificationAdapter;

  // Feature flags
  features?: {
    /** Enable document locking (default: true) */
    documentLocking?: boolean;
    /** Lock duration in milliseconds (default: 30 minutes) */
    lockDurationMs?: number;
    /** Enable stewardship/approval workflow (default: true) */
    stewardship?: boolean;
    /** Enable vector store indexing (default: false) */
    vectorIndexing?: boolean;
    /** Enable notifications (default: false) */
    notifications?: boolean;
  };
}

/**
 * Create a Context Nest instance with the given configuration
 */
export interface ContextNestInstance {
  config: ContextNestConfig;

  // Document operations
  documents: {
    create: (data: Parameters<DocumentStorageAdapter["createDocument"]>[0]) => Promise<ContextDocument>;
    get: (id: string) => Promise<ContextDocument | null>;
    update: (id: string, data: Partial<ContextDocument>) => Promise<ContextDocument>;
    delete: (id: string) => Promise<void>;
    list: (params: Parameters<DocumentStorageAdapter["listDocuments"]>[0]) => Promise<ReturnType<DocumentStorageAdapter["listDocuments"]>>;
    search: (query: string, dataRoomId?: string, limit?: number) => Promise<DocumentSearchResult[]>;
  };

  // Lifecycle operations
  lifecycle: {
    submitForReview: (documentId: string, note?: string, priority?: ReviewRequestPriority) => Promise<ReviewRequest>;
    approve: (documentId: string, version: number, note?: string) => Promise<ContextDocument>;
    reject: (documentId: string, version: number, note: string) => Promise<ContextDocument>;
    cancelReview: (documentId: string) => Promise<ContextDocument>;
  };

  // Stewardship operations
  stewardship: {
    assign: (data: Omit<ContextSteward, "id">) => Promise<ContextSteward>;
    remove: (id: string) => Promise<void>;
    getForDocument: (documentId: string) => Promise<ContextSteward[]>;
    canApprove: (documentId: string, userId: string) => Promise<boolean>;
  };

  // Review queue
  reviews: {
    getQueue: (params: Parameters<StewardshipStorageAdapter["getReviewQueue"]>[0]) => Promise<ReturnType<StewardshipStorageAdapter["getReviewQueue"]>>;
    getForUser: (userId: string) => Promise<ReviewRequest[]>;
  };
}
