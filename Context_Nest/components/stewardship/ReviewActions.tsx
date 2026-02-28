"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface ReviewActionsProps {
  documentId: string;
  documentTitle: string;
  version: number;
  onApproved?: () => void;
  onRejected?: () => void;
  className?: string;
}

type ActionType = "approve" | "reject" | null;

export function ReviewActions({
  documentId,
  documentTitle,
  version,
  onApproved,
  onRejected,
  className,
}: ReviewActionsProps) {
  const [actionType, setActionType] = useState<ActionType>(null);
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async () => {
    if (!actionType) return;

    // Reject requires a note
    if (actionType === "reject" && !note.trim()) {
      setError("Please provide feedback explaining why this document is being rejected.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      if (actionType === "approve") {
        const { approveVersion } = await import("@/app/actions/documentLifecycle");
        const result = await approveVersion(documentId, version, note || undefined);

        if (!result.success) {
          throw new Error(result.error);
        }

        toast.success(`Document approved - v${version} is now AI-ready`);
        onApproved?.();
      } else {
        const { rejectVersion } = await import("@/app/actions/documentLifecycle");
        const result = await rejectVersion(documentId, version, note);

        if (!result.success) {
          throw new Error(result.error);
        }

        toast.success("Document returned to author with feedback");
        onRejected?.();
      }

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${actionType} document`);
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing) {
      setActionType(null);
      setNote("");
      setError(null);
    }
  };

  return (
    <>
      <div className={className} data-testid="review-actions">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
            onClick={() => setActionType("approve")}
            data-testid="approve-button"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Approve
          </Button>
          <Button
            variant="outline"
            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
            onClick={() => setActionType("reject")}
            data-testid="reject-button"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Request Changes
          </Button>
        </div>
      </div>

      <Dialog open={!!actionType} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[425px]" data-testid="review-action-modal">
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Document" : "Request Changes"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve" ? (
                <>
                  Approve &ldquo;{documentTitle}&rdquo; (v{version}). This version will become
                  the official AI context for this document.
                </>
              ) : (
                <>
                  Request changes for &ldquo;{documentTitle}&rdquo; (v{version}). The author
                  will be notified with your feedback.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="review-note">
                <MessageSquare className="h-4 w-4 inline mr-2" />
                {actionType === "approve" ? "Note (optional)" : "Feedback (required)"}
              </Label>
              <Textarea
                id="review-note"
                placeholder={
                  actionType === "approve"
                    ? "Add any notes for the author..."
                    : "Explain what changes are needed..."
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={processing}
                className="min-h-[100px]"
                data-testid="review-note-input"
              />
              {actionType === "reject" && (
                <p className="text-xs text-muted-foreground">
                  Providing clear feedback helps authors make the right changes.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              className={
                actionType === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
              data-testid="confirm-review-action"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : actionType === "approve" ? (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {actionType === "approve" ? "Approve" : "Request Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ReviewActions;
