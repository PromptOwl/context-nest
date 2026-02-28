"use client";

import React, { useEffect, useState } from "react";
import { Hash, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Tag {
  id: string;
  name: string;
  color: string;
  count: number;
}

interface TagFilterProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  className?: string;
}

export function TagFilter({
  selectedTags,
  onTagsChange,
  className,
}: TagFilterProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all tags
  const fetchTags = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/data-room/tags/search?limit=50");
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const toggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onTagsChange(selectedTags.filter((t) => t !== tagName));
    } else {
      onTagsChange([...selectedTags, tagName]);
    }
  };

  const clearTags = () => {
    onTagsChange([]);
  };

  return (
    <div className={cn("", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between"
            data-testid="tag-filter-toggle"
          >
            <span className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Tags
            </span>
            <span className="flex items-center gap-2">
              {selectedTags.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                  {selectedTags.length} selected
                </span>
              )}
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </span>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="pt-2">
            {/* Selected tags */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2 p-2 bg-muted/30 rounded">
                {selectedTags.map((tagName) => (
                  <Badge
                    key={tagName}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => toggleTag(tagName)}
                  >
                    #{tagName}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-xs"
                  onClick={clearTags}
                >
                  Clear all
                </Button>
              </div>
            )}

            {/* Available tags */}
            {loading ? (
              <div className="text-sm text-muted-foreground p-2">
                Loading tags...
              </div>
            ) : tags.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2">
                No tags yet
              </div>
            ) : (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      className={cn(
                        "flex items-center justify-between w-full p-2 rounded hover:bg-muted/50 text-left",
                        selectedTags.includes(tag.name) && "bg-muted"
                      )}
                      onClick={() => toggleTag(tag.name)}
                      data-testid={`tag-filter-${tag.name}`}
                    >
                      <span className="flex items-center gap-2">
                        <Hash
                          className="h-4 w-4 flex-shrink-0"
                          style={{ color: tag.color }}
                        />
                        <span className="text-sm">{tag.name}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {tag.count}
                      </span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default TagFilter;
