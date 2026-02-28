"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2,
  UserPlus,
  AlertCircle,
  Search,
  Tag,
  Folder,
  FileText,
  Building2,
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import type { StewardshipScope } from "@/db/models/contextSteward";

interface TeamMember {
  _id: string;
  userId: string;
  name?: string;
  email: string;
  image?: string;
}

interface DocumentOption {
  _id: string;
  title: string;
}

interface FolderOption {
  _id: string;
  name: string;
  path: string;
}

interface StewardAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataRoomId: string;
  // Pre-select scope and target if coming from a specific context
  initialScope?: StewardshipScope;
  initialTarget?: {
    documentId?: string;
    folderId?: string;
    tagName?: string;
    displayName?: string;
  };
  onAssigned?: () => void;
}

const scopeConfig: Record<StewardshipScope, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  document: { label: "Document", icon: FileText },
  folder: { label: "Folder", icon: Folder },
  tag: { label: "Tag", icon: Tag },
  dataRoom: { label: "Data Room", icon: Building2 },
};

export function StewardAssignmentModal({
  isOpen,
  onClose,
  dataRoomId,
  initialScope,
  initialTarget,
  onAssigned,
}: StewardAssignmentModalProps) {
  const [scope, setScope] = useState<StewardshipScope>(initialScope || "tag");
  const [scopeTarget, setScopeTarget] = useState<string>(
    initialTarget?.documentId ||
    initialTarget?.folderId ||
    initialTarget?.tagName ||
    ""
  );
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [permissions, setPermissions] = useState({
    canApprove: true,
    canReject: true,
    canDelegate: false,
  });
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load team members and scope-specific data
  useEffect(() => {
    if (isOpen && dataRoomId) {
      loadTeamMembers();
      loadDocuments();
      loadFolders();
    }
  }, [isOpen, dataRoomId]);

  const loadDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const { getUserDocumentsForDataRoom } = await import("@/app/actions/dataRoomDocuments");
      const result = await getUserDocumentsForDataRoom(dataRoomId);

      if (result.success && result.documents) {
        setDocuments(result.documents);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const loadFolders = async () => {
    setLoadingFolders(true);
    try {
      const { getUserFoldersForDataRoom } = await import("@/app/actions/dataRoomDocuments");
      const result = await getUserFoldersForDataRoom(dataRoomId);

      if (result.success && result.folders) {
        setFolders(result.folders);
      }
    } catch (err) {
      console.error("Failed to load folders:", err);
    } finally {
      setLoadingFolders(false);
    }
  };

  const loadTeamMembers = async () => {
    setLoadingMembers(true);
    try {
      // Fetch team members from the data room's team
      const { getDataRoomTeam } = await import("@/app/actions/dataRoomTeam");
      const result = await getDataRoomTeam(dataRoomId);

      if (result.success && result.members) {
        setTeamMembers(result.members);
      }
    } catch (err) {
      console.error("Failed to load team members:", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const filteredMembers = teamMembers.filter(
    (m) =>
      m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAssign = async () => {
    if (!selectedUser) {
      setError("Please select a team member");
      return;
    }

    if (scope !== "dataRoom" && !scopeTarget) {
      setError(`Please specify the ${scope} to assign stewardship for`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { assignSteward } = await import("@/app/actions/contextStewardship");
      const result = await assignSteward({
        dataRoomId,
        scope,
        scopeTarget: scope === "dataRoom" ? undefined : scopeTarget,
        stewardUserId: selectedUser,
        permissions,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      const member = teamMembers.find((m) => m.userId === selectedUser);
      toast.success(`${member?.name || member?.email} assigned as steward`);
      onAssigned?.();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign steward");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setScope(initialScope || "tag");
      setScopeTarget(
        initialTarget?.documentId ||
        initialTarget?.folderId ||
        initialTarget?.tagName ||
        ""
      );
      setSelectedUser("");
      setSearchQuery("");
      setPermissions({ canApprove: true, canReject: true, canDelegate: false });
      setError(null);
      setDocuments([]);
      setFolders([]);
      onClose();
    }
  };

  const ScopeIcon = scopeConfig[scope].icon;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" data-testid="steward-assignment-modal">
        <DialogHeader>
          <DialogTitle>Assign Context Steward</DialogTitle>
          <DialogDescription>
            Stewards can approve or reject documents within their assigned scope,
            ensuring quality context is available for AI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Scope Selection */}
          <div className="space-y-2">
            <Label>Stewardship Scope</Label>
            <Select
              value={scope}
              onValueChange={(v) => {
                setScope(v as StewardshipScope);
                setScopeTarget("");
              }}
              disabled={loading || !!initialScope}
            >
              <SelectTrigger data-testid="scope-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(scopeConfig) as [StewardshipScope, typeof scopeConfig[StewardshipScope]][]).map(
                  ([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  }
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Scope Target */}
          {scope !== "dataRoom" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="scope-target">
                  <ScopeIcon className="h-4 w-4 inline mr-2" />
                  {scope === "tag" ? "Tag Name" : scope === "folder" ? "Folder" : "Document"}
                </Label>
                {(scope === "document" || scope === "folder") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      if (scope === "document") {
                        loadDocuments();
                      } else if (scope === "folder") {
                        loadFolders();
                      }
                    }}
                    disabled={loading || (scope === "document" ? loadingDocuments : loadingFolders)}
                    data-testid="refresh-scope-data"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${(scope === "document" ? loadingDocuments : loadingFolders) ? "animate-spin" : ""}`} />
                  </Button>
                )}
              </div>
              {initialTarget?.displayName ? (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <ScopeIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{initialTarget.displayName}</span>
                </div>
              ) : scope === "document" ? (
                <Select
                  value={scopeTarget}
                  onValueChange={setScopeTarget}
                  disabled={loading || loadingDocuments}
                >
                  <SelectTrigger data-testid="document-select">
                    <SelectValue placeholder={loadingDocuments ? "Loading documents..." : "Select a document"} />
                  </SelectTrigger>
                  <SelectContent>
                    {documents.length === 0 ? (
                      <div className="py-2 px-3 text-sm text-muted-foreground">
                        No documents found
                      </div>
                    ) : (
                      documents.map((doc) => (
                        <SelectItem key={doc._id} value={doc._id}>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {doc.title}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              ) : scope === "folder" ? (
                <Select
                  value={scopeTarget}
                  onValueChange={setScopeTarget}
                  disabled={loading || loadingFolders}
                >
                  <SelectTrigger data-testid="folder-select">
                    <SelectValue placeholder={loadingFolders ? "Loading folders..." : "Select a folder"} />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.length === 0 ? (
                      <div className="py-2 px-3 text-sm text-muted-foreground">
                        No folders found
                      </div>
                    ) : (
                      folders.map((folder) => (
                        <SelectItem key={folder._id} value={folder._id}>
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4" />
                            {folder.name}
                            <span className="text-xs text-muted-foreground">({folder.path})</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="scope-target"
                  placeholder="e.g., marketing, onboarding"
                  value={scopeTarget}
                  onChange={(e) => setScopeTarget(e.target.value)}
                  disabled={loading}
                  data-testid="scope-target-input"
                />
              )}
            </div>
          )}

          {/* Team Member Selection */}
          <div className="space-y-2">
            <Label>Assign To</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                disabled={loading || loadingMembers}
                data-testid="member-search-input"
              />
            </div>
            <div className="border rounded-md max-h-[200px] overflow-y-auto">
              {loadingMembers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  {searchQuery ? "No members found" : "No team members available"}
                </div>
              ) : (
                filteredMembers.map((member) => (
                  <div
                    key={member._id}
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedUser === member.userId ? "bg-muted" : ""
                    }`}
                    onClick={() => setSelectedUser(member.userId)}
                    data-testid={`member-option-${member.userId}`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.image} />
                      <AvatarFallback>
                        {(member.name || member.email)[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {member.name || member.email}
                      </p>
                      {member.name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {member.email}
                        </p>
                      )}
                    </div>
                    {selectedUser === member.userId && (
                      <div className="h-4 w-4 rounded-full bg-primary" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-3">
            <Label>Permissions</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="can-approve"
                  checked={permissions.canApprove}
                  onCheckedChange={(checked) =>
                    setPermissions((p) => ({ ...p, canApprove: !!checked }))
                  }
                  disabled={loading}
                />
                <Label htmlFor="can-approve" className="font-normal cursor-pointer">
                  Can approve documents
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="can-reject"
                  checked={permissions.canReject}
                  onCheckedChange={(checked) =>
                    setPermissions((p) => ({ ...p, canReject: !!checked }))
                  }
                  disabled={loading}
                />
                <Label htmlFor="can-reject" className="font-normal cursor-pointer">
                  Can reject/request changes
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="can-delegate"
                  checked={permissions.canDelegate}
                  onCheckedChange={(checked) =>
                    setPermissions((p) => ({ ...p, canDelegate: !!checked }))
                  }
                  disabled={loading}
                />
                <Label htmlFor="can-delegate" className="font-normal cursor-pointer">
                  Can delegate stewardship to others
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={loading || !selectedUser}
            data-testid="confirm-assign-steward"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Assign Steward
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StewardAssignmentModal;
