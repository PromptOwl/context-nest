"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Ban,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewRequestStatus } from "@/db/models/reviewRequest";

interface ReviewHistoryItem {
  _id: string;
  version: number;
  status: ReviewRequestStatus;
  requestedBy: {
    _id: string;
    name?: string;
    email: string;
    image?: string;
  };
  requestedAt: string;
  requestNote?: string;
  resolvedBy?: {
    _id: string;
    name?: string;
    email: string;
  };
  resolvedAt?: string;
  resolutionNote?: string;
  priority: string;
}

interface ApprovalHistoryProps {
  documentId: string;
  className?: string;
  maxItems?: number;
}

const statusConfig: Record<
  ReviewRequestStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    className: string;
  }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-amber-100 text-amber-700",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-700",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-red-100 text-red-700",
  },
  cancelled: {
    label: "Cancelled",
    icon: Ban,
    className: "bg-gray-100 text-gray-700",
  },
};

export function ApprovalHistory({
  documentId,
  className,
  maxItems = 10,
}: ApprovalHistoryProps) {
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [approvedVersion, setApprovedVersion] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { getDocumentLifecycleHistory } = await import(
        "@/app/actions/documentLifecycle"
      );
      const result = await getDocumentLifecycleHistory(documentId);

      if (result.success) {
        setHistory(result.reviewHistory?.slice(0, maxItems) || []);
        setCurrentStatus(result.currentStatus || null);
        setApprovedVersion(result.approvedVersion || null);
      }
    } catch (err) {
      console.error("Failed to fetch approval history:", err);
    } finally {
      setLoading(false);
    }
  }, [documentId, maxItems]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Approval History
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
    <Card className={className} data-testid="approval-history">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4" />
          Approval History
          {approvedVersion && (
            <Badge variant="secondary" className="text-[10px] ml-auto">
              v{approvedVersion} approved
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No review history yet
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[15px] top-0 bottom-0 w-[2px] bg-border" />

            <div className="space-y-4">
              {history.map((item, index) => {
                const config = statusConfig[item.status];
                const StatusIcon = config.icon;

                return (
                  <div
                    key={item._id}
                    className="relative pl-10"
                    data-testid={`history-item-${item._id}`}
                  >
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        "absolute left-[7px] top-1 w-[18px] h-[18px] rounded-full flex items-center justify-center",
                        config.className
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                    </div>

                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0", config.className)}
                        >
                          {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          v{item.version}
                        </span>
                      </div>

                      {/* Submitted by */}
                      <div className="flex items-center gap-2 text-xs mb-1">
                        <Send className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Submitted by</span>
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={item.requestedBy.image} />
                          <AvatarFallback className="text-[8px]">
                            {(item.requestedBy.name || item.requestedBy.email)[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {item.requestedBy.name || item.requestedBy.email}
                        </span>
                      </div>

                      {item.requestNote && (
                        <p className="text-xs text-muted-foreground ml-5 mb-1">
                          &ldquo;{item.requestNote}&rdquo;
                        </p>
                      )}

                      {/* Resolved by */}
                      {item.resolvedBy && item.resolvedAt && (
                        <div className="flex items-center gap-2 text-xs mt-2 pt-2 border-t border-dashed">
                          <StatusIcon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {item.status === "approved"
                              ? "Approved by"
                              : item.status === "rejected"
                              ? "Rejected by"
                              : "Resolved by"}
                          </span>
                          <span className="font-medium">
                            {item.resolvedBy.name || item.resolvedBy.email}
                          </span>
                        </div>
                      )}

                      {item.resolutionNote && (
                        <p className="text-xs text-muted-foreground ml-5 mt-1">
                          &ldquo;{item.resolutionNote}&rdquo;
                        </p>
                      )}

                      <div className="text-[10px] text-muted-foreground mt-2">
                        {formatDate(item.requestedAt)}
                        {item.resolvedAt &&
                          ` → ${formatDate(item.resolvedAt)}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ApprovalHistory;
