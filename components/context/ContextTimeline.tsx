"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  FilePlus,
  FileCheck,
  FileX,
  Clock,
  Shield,
  Users,
  Filter,
  Calendar,
  ChevronDown,
  Loader2,
  GitCommit,
  ArrowRight,
  Activity,
  TrendingUp,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TimelineEvent, TimelineEventType, TimelineStats } from "@/app/actions/contextTimeline";

interface ContextTimelineProps {
  dataRoomId: string;
}

const EVENT_TYPE_CONFIG: Record<
  TimelineEventType,
  { icon: React.ElementType; color: string; label: string }
> = {
  document_created: {
    icon: FilePlus,
    color: "text-blue-500",
    label: "Created",
  },
  document_updated: {
    icon: FileText,
    color: "text-gray-500",
    label: "Updated",
  },
  document_submitted: {
    icon: Clock,
    color: "text-amber-500",
    label: "Submitted for Review",
  },
  document_approved: {
    icon: FileCheck,
    color: "text-green-500",
    label: "Approved",
  },
  document_rejected: {
    icon: FileX,
    color: "text-red-500",
    label: "Rejected",
  },
  steward_assigned: {
    icon: Shield,
    color: "text-purple-500",
    label: "Steward Assigned",
  },
  steward_removed: {
    icon: Shield,
    color: "text-gray-400",
    label: "Steward Removed",
  },
  version_created: {
    icon: GitCommit,
    color: "text-indigo-500",
    label: "New Version",
  },
};

const DATE_RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export function ContextTimeline({ dataRoomId }: ContextTimelineProps) {
  const router = useRouter();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [stats, setStats] = useState<TimelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [dateRange, setDateRange] = useState("30d");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [selectedContributor, setSelectedContributor] = useState<string>("");
  const [selectedEventTypes, setSelectedEventTypes] = useState<TimelineEventType[]>([]);

  // Filter options
  const [tags, setTags] = useState<string[]>([]);
  const [contributors, setContributors] = useState<Array<{ id: string; name: string; email: string }>>([]);

  // Pagination
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const getDateFromRange = (range: string): Date | undefined => {
    const now = new Date();
    switch (range) {
      case "7d":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30d":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "90d":
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return undefined;
    }
  };

  const fetchFilterOptions = useCallback(async () => {
    try {
      const { getTimelineFilterOptions } = await import("@/app/actions/contextTimeline");
      const result = await getTimelineFilterOptions(dataRoomId);
      if (result.success) {
        setTags(result.tags || []);
        setContributors(result.contributors || []);
      }
    } catch (err) {
      console.error("Failed to fetch filter options:", err);
    }
  }, [dataRoomId]);

  const fetchStats = useCallback(async () => {
    try {
      const { getTimelineStats } = await import("@/app/actions/contextTimeline");
      const result = await getTimelineStats(dataRoomId);
      if (result.success && result.stats) {
        setStats(result.stats);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [dataRoomId]);

  const fetchTimeline = useCallback(
    async (reset = false) => {
      if (reset) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      try {
        const { getContextTimeline } = await import("@/app/actions/contextTimeline");

        const result = await getContextTimeline({
          dataRoomId,
          startDate: getDateFromRange(dateRange),
          tagName: selectedTag || undefined,
          actorId: selectedContributor || undefined,
          eventTypes: selectedEventTypes.length > 0 ? selectedEventTypes : undefined,
          limit,
          offset: reset ? 0 : offset,
        });

        if (result.success) {
          if (reset) {
            setEvents(result.events);
          } else {
            setEvents((prev) => [...prev, ...result.events]);
          }
          setTotal(result.total);
        }
      } catch (err) {
        console.error("Failed to fetch timeline:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [dataRoomId, dateRange, selectedTag, selectedContributor, selectedEventTypes, offset]
  );

  useEffect(() => {
    fetchFilterOptions();
    fetchStats();
  }, [fetchFilterOptions, fetchStats]);

  useEffect(() => {
    fetchTimeline(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, selectedTag, selectedContributor, selectedEventTypes]);

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const groupEventsByDate = (events: TimelineEvent[]) => {
    const groups: Record<string, TimelineEvent[]> = {};
    for (const event of events) {
      const dateKey = formatDate(event.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    }
    return groups;
  };

  const toggleEventType = (type: TimelineEventType) => {
    setSelectedEventTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const hasMoreEvents = events.length < total;

  const loadMore = () => {
    setOffset((prev) => prev + limit);
    fetchTimeline(false);
  };

  const groupedEvents = groupEventsByDate(events);

  return (
    <div className="container py-8 px-6 max-w-5xl" data-testid="context-timeline">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Context Timeline</h1>
          <p className="text-muted-foreground">
            Track changes, approvals, and activity across your context
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchTimeline(true);
            fetchStats();
          }}
          data-testid="timeline-refresh-button"
        >
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Documents Created</CardDescription>
              <CardTitle className="text-2xl">{stats.documentsCreated}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FilePlus className="h-3 w-3" />
                <span>Last 30 days</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Approved</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.documentsApproved}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileCheck className="h-3 w-3" />
                <span>AI-ready</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Contributors</CardDescription>
              <CardTitle className="text-2xl">{stats.activeContributors}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>Last 30 days</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Events</CardDescription>
              <CardTitle className="text-2xl">{stats.totalEvents}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span>Last 30 days</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[150px]" data-testid="timeline-date-filter">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tags.length > 0 && (
          <Select value={selectedTag || "__all__"} onValueChange={(v) => setSelectedTag(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-[150px]" data-testid="timeline-tag-filter">
              <SelectValue placeholder="All tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All tags</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  #{tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {contributors.length > 0 && (
          <Select value={selectedContributor || "__all__"} onValueChange={(v) => setSelectedContributor(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-[180px]" data-testid="timeline-contributor-filter">
              <SelectValue placeholder="All contributors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All contributors</SelectItem>
              {contributors.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="timeline-type-filter">
              <Filter className="h-4 w-4 mr-2" />
              Event Types
              {selectedEventTypes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedEventTypes.length}
                </Badge>
              )}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Filter by event type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(EVENT_TYPE_CONFIG).map(([type, config]) => (
              <DropdownMenuCheckboxItem
                key={type}
                checked={selectedEventTypes.includes(type as TimelineEventType)}
                onCheckedChange={() => toggleEventType(type as TimelineEventType)}
              >
                <config.icon className={cn("h-4 w-4 mr-2", config.color)} />
                {config.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {(selectedTag || selectedContributor || selectedEventTypes.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedTag("");
              setSelectedContributor("");
              setSelectedEventTypes([]);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium">No activity yet</p>
            <p className="text-muted-foreground mt-1">
              Timeline events will appear here as you create and manage documents
            </p>
            <Button
              className="mt-4"
              onClick={() => router.push("/data-room/documents/new")}
            >
              Create your first document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedEvents).map(([date, dayEvents]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-border" />
                <Badge variant="outline" className="text-xs font-medium">
                  {date}
                </Badge>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Events for this day */}
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[23px] top-0 bottom-0 w-px bg-border" />

                <div className="space-y-4">
                  {dayEvents.map((event) => {
                    const config = EVENT_TYPE_CONFIG[event.type];
                    const Icon = config.icon;

                    return (
                      <div
                        key={event.id}
                        className="relative flex items-start gap-4 pl-2"
                        data-testid={`timeline-event-${event.id}`}
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            "relative z-10 flex items-center justify-center w-10 h-10 rounded-full bg-background border-2",
                            event.type === "document_approved" && "border-green-200 bg-green-50",
                            event.type === "document_rejected" && "border-red-200 bg-red-50",
                            event.type === "document_submitted" && "border-amber-200 bg-amber-50",
                            event.type === "document_created" && "border-blue-200 bg-blue-50",
                            event.type === "version_created" && "border-indigo-200 bg-indigo-50",
                            event.type === "steward_assigned" && "border-purple-200 bg-purple-50",
                            event.type === "steward_removed" && "border-gray-200 bg-gray-50"
                          )}
                        >
                          <Icon className={cn("h-4 w-4", config.color)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={event.actorImage} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(event.actorName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{event.actorName}</span>
                            <span className="text-muted-foreground text-sm">{config.label.toLowerCase()}</span>
                            {event.documentTitle && (
                              <button
                                className="font-medium text-sm text-primary hover:underline truncate max-w-[200px]"
                                onClick={() => router.push(`/data-room/documents/${event.documentId}`)}
                              >
                                {event.documentTitle}
                              </button>
                            )}
                            {event.version && event.version > 1 && (
                              <Badge variant="outline" className="text-[10px]">
                                v{event.version}
                              </Badge>
                            )}
                          </div>

                          {event.note && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {event.note}
                            </p>
                          )}

                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTime(event.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* Load More */}
          {hasMoreEvents && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
                data-testid="timeline-load-more"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Load more
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ContextTimeline;
