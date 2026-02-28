/**
 * Context Nest - Core Types
 *
 * These types define the data structures used by the Context Nest feature.
 * They are decoupled from the database models to allow for independent operation.
 */

// Document lifecycle states
export type DocumentLifecycleStatus = "draft" | "pending_review" | "approved" | "rejected";

// Stewardship scope types
export type StewardshipScope = "document" | "folder" | "tag" | "dataRoom";

// Review request priority levels
export type ReviewRequestPriority = "low" | "normal" | "high" | "urgent";

// Review request status
export type ReviewRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

// Wiki link structure
export interface WikiLink {
  text: string;
  displayText: string;
  targetId: string | null;
  targetTitle: string;
}

// Mention structure
export interface Mention {
  type: "user" | "team";
  name: string;
  id?: string;
}

// Task structure
export interface Task {
  id: string;
  text: string;
  completed: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
}

// Document version structure
export interface DocumentVersion {
  version: number;
  content: string;
  editedBy: string;
  editedAt: Date;
  changeNote?: string;
}

// Core document structure (database-agnostic)
export interface ContextDocument {
  id: string;
  title: string;
  content: string;
  dataRoomId: string;
  folderId?: string;
  ownerId: string;
  tags: string[];
  wikiLinks: WikiLink[];
  mentions: Mention[];
  tasks: Task[];
  backlinks: string[];
  version: number;
  versions: DocumentVersion[];

  // Lock state
  lockedBy?: string;
  lockedAt?: Date;
  lockExpiresAt?: Date;

  // Lifecycle state
  lifecycleStatus: DocumentLifecycleStatus;
  approvedVersion: number | null;
  approvedAt?: Date;
  approvedBy?: string;
  reviewRequestedAt?: Date;
  reviewRequestedBy?: string;
  reviewNote?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Steward assignment structure
export interface ContextSteward {
  id: string;
  dataRoomId: string;
  scope: StewardshipScope;
  documentId?: string;
  folderId?: string;
  tagName?: string;
  stewardUserId: string;
  canApprove: boolean;
  canReject: boolean;
  canDelegate: boolean;
  assignedBy: string;
  assignedAt: Date;
  isActive: boolean;
}

// Review request structure
export interface ReviewRequest {
  id: string;
  dataRoomId: string;
  documentId: string;
  version: number;
  requestedBy: string;
  requestedAt: Date;
  requestNote?: string;
  status: ReviewRequestStatus;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNote?: string;
  priority: ReviewRequestPriority;
}

// User reference (minimal info needed)
export interface UserRef {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

// Search results
export interface DocumentSearchResult {
  id: string;
  title: string;
  tags: string[];
  updatedAt: Date;
}

export interface TagSearchResult {
  name: string;
  documentCount: number;
}

export interface MentionSearchResult {
  id: string;
  name: string;
  email?: string;
  type: "user" | "team";
}
