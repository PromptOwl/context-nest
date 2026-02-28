"use client";

import React, { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  MoreVertical,
  Trash2,
  Shield,
  Tag,
  Folder,
  FileText,
  Building2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { StewardshipScope } from "@/db/models/contextSteward";
import type { Steward } from "@/hooks/useContextDashboard";

interface StewardListProps {
  stewards: Steward[];
  loading?: boolean;
  showScope?: boolean;
  className?: string;
  onAddSteward?: () => void;
  onRefresh?: () => void;
  compact?: boolean;
}

const scopeConfig: Record<StewardshipScope, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  document: { label: "Document", icon: FileText },
  folder: { label: "Folder", icon: Folder },
  tag: { label: "Tag", icon: Tag },
  dataRoom: { label: "Data Room", icon: Building2 },
};

export function StewardList({
  stewards,
  loading = false,
  showScope = false,
  className,
  onAddSteward,
  onRefresh,
  compact = false,
}: StewardListProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (stewardId: string) => {
    setRemovingId(stewardId);
    try {
      const { removeSteward } = await import("@/app/actions/contextStewardship");
      const result = await removeSteward(stewardId);

      if (result.success) {
        toast.success("Steward removed");
        onRefresh?.();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove steward");
    } finally {
      setRemovingId(null);
    }
  };

  const getScopeLabel = (steward: Steward) => {
    const config = scopeConfig[steward.scope];
    let target = "";
    if (steward.scope === "tag") target = steward.tagName || "";
    else if (steward.scope === "document") target = steward.documentId || "";
    else if (steward.scope === "folder") target = steward.folderId || "";

    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <config.icon className="h-3 w-3" />
        <span>{config.label}</span>
        {target && <span className="opacity-75">: {target}</span>}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stewards.length === 0) {
    return (
      <div className={cn("text-center py-4", className)}>
        <Shield className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-2">No stewards assigned</p>
        {onAddSteward && (
          <Button variant="outline" size="sm" onClick={onAddSteward}>
            <UserPlus className="h-4 w-4 mr-2" />
            Assign Steward
          </Button>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Shield className="h-4 w-4 text-muted-foreground" />
        <div className="flex -space-x-2">
          {stewards.slice(0, 3).map((steward) => (
            <Avatar key={steward._id} className="h-6 w-6 border-2 border-background">
              <AvatarImage src={steward.stewardUserId.image} />
              <AvatarFallback className="text-[10px]">
                {(steward.stewardUserId.name || steward.stewardUserId.email)[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        {stewards.length > 3 && (
          <span className="text-xs text-muted-foreground">
            +{stewards.length - 3}
          </span>
        )}
        {onAddSteward && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onAddSteward}
          >
            <UserPlus className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)} data-testid="steward-list">
      {stewards.map((steward) => (
        <div
          key={steward._id}
          className="flex items-center gap-3 p-2 rounded-lg border bg-card"
          data-testid={`steward-item-${steward._id}`}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={steward.stewardUserId?.image} />
            <AvatarFallback>
              {(steward.stewardUserId.name || steward.stewardUserId.email)[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {steward.stewardUserId.name || steward.stewardUserId.email}
            </p>
            {showScope && getScopeLabel(steward)}
            <div className="flex items-center gap-1 mt-1">
              {steward.canApprove && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Approve
                </Badge>
              )}
              {steward.canReject && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Reject
                </Badge>
              )}
              {steward.canDelegate && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Delegate
                </Badge>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={removingId === steward._id}
              >
                {removingId === steward._id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreVertical className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleRemove(steward._id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
      {onAddSteward && (
        <Button
          variant="outline"
          className="w-full"
          onClick={onAddSteward}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add Steward
        </Button>
      )}
    </div>
  );
}

export default StewardList;
