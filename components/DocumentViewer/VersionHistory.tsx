"use client";

import React, { useEffect, useState } from "react";
import { History, RotateCcw, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Version {
  version: number;
  content: string;
  editedBy: string;
  editedAt: string;
  changeNote: string;
}

interface VersionHistoryProps {
  documentId: string;
  currentVersion: number;
  onRestore?: (versionNumber: number) => void;
  className?: string;
}

export function VersionHistory({
  documentId,
  currentVersion,
  onRestore,
  className,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<Version | null>(null);
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Fetch version history
  const fetchVersions = async () => {
    setLoading(true);
    try {
      const { getDocumentVersions } = await import(
        "@/app/actions/dataRoomDocuments"
      );
      const result = await getDocumentVersions(documentId);

      if (result.success) {
        setVersions(result.versions || []);
      }
    } catch (err) {
      console.error("Failed to fetch versions:", err);
    } finally {
      setLoading(false);
    }
  };


  // Handle restore
  const handleRestore = async () => {
    if (!restoreVersion) return;

    setRestoring(true);
    try {
      const { restoreDocumentVersion } = await import(
        "@/app/actions/dataRoomDocuments"
      );
      const result = await restoreDocumentVersion(documentId, restoreVersion);

      if (result.success) {
        onRestore?.(restoreVersion);
        setRestoreVersion(null);
        fetchVersions();
      }
    } catch (err) {
      console.error("Failed to restore version:", err);
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Fetch on mount
  useEffect(() => {
    fetchVersions();
  }, [documentId]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="version-history">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4" />
          Version History
          <Badge variant="secondary" className="text-[10px] ml-auto">
            v{currentVersion}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No previous versions
          </div>
        ) : (
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1">
              {versions
                .slice()
                .reverse()
                .map((version) => (
                  <div
                    key={version.version}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted/50 group"
                    data-testid={`version-item-${version.version}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        Version {version.version}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {formatDate(version.editedAt)}
                        {version.changeNote && ` • ${version.changeNote}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setPreviewVersion(version)}
                        data-testid={`preview-version-${version.version}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setRestoreVersion(version.version)}
                        data-testid={`restore-version-${version.version}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Preview Dialog */}
      <Dialog
        open={!!previewVersion}
        onOpenChange={() => setPreviewVersion(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Version {previewVersion?.version} Preview</DialogTitle>
            <DialogDescription>
              {previewVersion && formatDate(previewVersion.editedAt)}
              {previewVersion?.changeNote &&
                ` • ${previewVersion.changeNote}`}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <div
              className="prose prose-sm dark:prose-invert p-4 bg-muted/30 rounded"
              dangerouslySetInnerHTML={{
                __html: previewVersion?.content || "",
              }}
            />
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewVersion(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (previewVersion) {
                  setRestoreVersion(previewVersion.version);
                  setPreviewVersion(null);
                }
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restore This Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog
        open={!!restoreVersion}
        onOpenChange={() => setRestoreVersion(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Version {restoreVersion}?</DialogTitle>
            <DialogDescription>
              This will create a new version with the content from version{" "}
              {restoreVersion}. Your current content will be saved in the
              version history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreVersion(null)}
              disabled={restoring}
            >
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={restoring}>
              {restoring ? "Restoring..." : "Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default VersionHistory;
