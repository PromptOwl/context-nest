"use client";

import React, { useEffect, useState } from "react";
import { Lock, Unlock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface LockIndicatorProps {
  documentId: string;
  currentUserId: string;
  onLockAcquired?: () => void;
  onLockReleased?: () => void;
  onLockConflict?: (lockedBy: string) => void;
  className?: string;
}

interface LockStatus {
  isLocked: boolean;
  lockedBy: string | null;
  lockedByUser?: {
    name?: string;
    email?: string;
  };
  expiresAt: string | null;
}

export function LockIndicator({
  documentId,
  currentUserId,
  onLockAcquired,
  onLockReleased,
  onLockConflict,
  className,
}: LockIndicatorProps) {
  const [status, setStatus] = useState<LockStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch lock status
  const fetchStatus = async () => {
    try {
      const { getDocumentLockStatus } = await import(
        "@/app/actions/dataRoomDocuments"
      );
      const result = await getDocumentLockStatus(documentId);

      if (result.success && 'isLocked' in result) {
        setStatus({
          isLocked: result.isLocked,
          lockedBy: result.lockedBy,
          lockedByUser: result.lockedByUser || undefined,
          expiresAt: result.expiresAt ? result.expiresAt.toISOString() : null,
        });
      }
    } catch (err) {
      console.error("Failed to fetch lock status:", err);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [documentId]);

  // Notify parent when already locked by current user on mount
  useEffect(() => {
    if (status?.lockedBy === currentUserId && status?.isLocked) {
      onLockAcquired?.();
    }
  }, [status?.lockedBy, status?.isLocked, currentUserId, onLockAcquired]);

  // Acquire lock
  const handleAcquireLock = async () => {
    setLoading(true);
    setError(null);

    try {
      const { acquireDocumentLock } = await import(
        "@/app/actions/dataRoomDocuments"
      );
      const result = await acquireDocumentLock(documentId);

      if (result.success) {
        await fetchStatus();
        onLockAcquired?.();
      } else {
        setError(result.error || "Failed to acquire lock");
        if (result.lockedBy && result.lockedBy !== currentUserId) {
          onLockConflict?.(result.lockedBy);
        }
      }
    } catch (err) {
      setError("Failed to acquire lock");
    } finally {
      setLoading(false);
    }
  };

  // Release lock
  const handleReleaseLock = async () => {
    setLoading(true);
    setError(null);

    try {
      const { releaseDocumentLock } = await import(
        "@/app/actions/dataRoomDocuments"
      );
      const result = await releaseDocumentLock(documentId);

      if (result.success) {
        await fetchStatus();
        onLockReleased?.();
      } else {
        setError(result.error || "Failed to release lock");
      }
    } catch (err) {
      setError("Failed to release lock");
    } finally {
      setLoading(false);
    }
  };

  const isLockedByMe = status?.lockedBy === currentUserId;
  const isLockedByOther = status?.isLocked && !isLockedByMe;

  const getTimeRemaining = () => {
    if (!status?.expiresAt) return null;
    const expires = new Date(status.expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return "Expired";
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m remaining`;
  };

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      data-testid="lock-indicator"
    >
      {error && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{error}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {isLockedByOther ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                <Lock className="h-4 w-4" />
                <span>
                  Locked by{" "}
                  {status?.lockedByUser?.name ||
                    status?.lockedByUser?.email ||
                    "another user"}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>This document is being edited by someone else.</p>
              <p className="text-xs text-muted-foreground">
                {getTimeRemaining()}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : isLockedByMe ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
            <Lock className="h-4 w-4" />
            <span>Editing</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {getTimeRemaining()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReleaseLock}
            disabled={loading}
            data-testid="release-lock-button"
          >
            <Unlock className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleAcquireLock}
          disabled={loading}
          data-testid="acquire-lock-button"
        >
          <Lock className="h-4 w-4 mr-1" />
          Start Editing
        </Button>
      )}
    </div>
  );
}

export default LockIndicator;
