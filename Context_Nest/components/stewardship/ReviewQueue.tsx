"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Clock,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ReviewRequestPriority } from "@/db/models/reviewRequest";

interface ReviewRequest {
  _id: string;
  document: {
    _id: string;
    title: string;
    tags?: string[];
    version: number;
  };
  version: number;
  requestedBy: {
    _id: string;
    name?: string;
    email: string;
    image?: string;
  };
  requestedAt: string;
  requestNote?: string;
  priority: ReviewRequestPriority;
  approvalReason?: string;
}

interface ReviewQueueProps {
  dataRoomId?: string;
  className?: string;
  maxItems?: number;
  showHeader?: boolean;
  onReviewComplete?: () => void;
}

const priorityConfig: Record<ReviewRequestPriority, { label: string; className: string; icon?: React.ComponentType<{ className?: string }> }> = {
  low: { label: "Low", className: "bg-gray-100 text-gray-600" },
  normal: { label: "Normal", className: "bg-blue-100 text-blue-600" },
  high: { label: "High", className: "bg-amber-100 text-amber-600", icon: AlertTriangle },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-600", icon: AlertTriangle },
};

export function ReviewQueue({
  dataRoomId,
  className,
  maxItems = 10,
  showHeader = true,
  onReviewComplete,
}: ReviewQueueProps) {
  const router = useRouter();
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { getMyReviewQueue } = await import("@/app/actions/documentLifecycle");
      const result = await getMyReviewQueue(dataRoomId);

      if (result.success) {
        setRequests(result.requests.slice(0, maxItems));
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, [dataRoomId, maxItems]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const handleReviewClick = (request: ReviewRequest) => {
    router.push(`/data-room/documents/${request.document._id}?review=true`);
  };

  if (loading) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Review Queue</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Review Queue</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-4 text-sm text-destructive">
            {error}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchQueue}
              className="ml-2"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="review-queue">
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Review Queue</CardTitle>
              <CardDescription>
                Documents awaiting your approval
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchQueue}
              className="h-8 w-8"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent>
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mb-3" />
            <p className="text-sm font-medium">All caught up!</p>
            <p className="text-xs text-muted-foreground">
              No documents awaiting review
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((request) => {
              const priorityCfg = priorityConfig[request.priority];
              const PriorityIcon = priorityCfg.icon;

              return (
                <div
                  key={request._id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors group"
                  onClick={() => handleReviewClick(request)}
                  data-testid={`review-item-${request._id}`}
                >
                  <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {request.document.title}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn("text-[10px] px-1.5 py-0", priorityCfg.className)}
                      >
                        {PriorityIcon && <PriorityIcon className="h-3 w-3 mr-1" />}
                        {priorityCfg.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>v{request.version}</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={request.requestedBy.image} />
                          <AvatarFallback className="text-[8px]">
                            {(request.requestedBy.name || request.requestedBy.email)[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{request.requestedBy.name || request.requestedBy.email}</span>
                      </div>
                      <span>•</span>
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(request.requestedAt)}</span>
                    </div>
                    {request.requestNote && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        &ldquo;{request.requestNote}&rdquo;
                      </p>
                    )}
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReviewQueue;
