"use client";

import React, { useEffect, useState } from "react";
import { Link2, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Backlink {
  _id: string;
  title: string;
}

interface BacklinksPanelProps {
  documentId: string;
  onNavigate?: (documentId: string) => void;
  className?: string;
}

export function BacklinksPanel({
  documentId,
  onNavigate,
  className,
}: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch backlinks
  const fetchBacklinks = async () => {
    setLoading(true);
    try {
      const { getDocumentBacklinks } = await import(
        "@/app/actions/dataRoomDocuments"
      );
      const result = await getDocumentBacklinks(documentId);

      if (result.success) {
        setBacklinks(result.backlinks || []);
      }
    } catch (err) {
      console.error("Failed to fetch backlinks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBacklinks();
  }, [documentId]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Backlinks
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
    <Card className={className} data-testid="backlinks-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Backlinks
          {backlinks.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {backlinks.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {backlinks.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No documents link to this page
          </div>
        ) : (
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1">
              {backlinks.map((link) => (
                <button
                  key={link._id}
                  className="flex items-center gap-2 w-full p-2 rounded hover:bg-muted/50 text-left"
                  onClick={() => onNavigate?.(link._id)}
                  data-testid={`backlink-${link._id}`}
                >
                  <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="text-sm truncate">{link.title}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default BacklinksPanel;
