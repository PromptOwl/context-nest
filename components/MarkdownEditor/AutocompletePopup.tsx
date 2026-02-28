"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { FileText, Hash, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutocompletePopupProps {
  type: "tag" | "wikiLink" | "mention";
  query: string;
  position: { top: number; left: number };
  dataRoomId?: string;
  onSelect: (item: any) => void;
  onClose: () => void;
}

interface AutocompleteItem {
  id: string;
  type?: "user" | "team";
  name?: string;
  title?: string;
  color?: string;
  count?: number;
  email?: string;
  needsAccess?: boolean;
  tags?: string[];
}

export function AutocompletePopup({
  type,
  query,
  position,
  dataRoomId,
  onSelect,
  onClose,
}: AutocompletePopupProps) {
  const [items, setItems] = useState<AutocompleteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);

  // Fetch autocomplete results
  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      let url = "";
      const params = new URLSearchParams();
      params.set("q", query);
      params.set("limit", "10");

      switch (type) {
        case "tag":
          url = `/api/data-room/tags/search?${params}`;
          break;
        case "wikiLink":
          if (dataRoomId) {
            params.set("dataRoomId", dataRoomId);
          }
          url = `/api/data-room/documents/search?${params}`;
          break;
        case "mention":
          url = `/api/data-room/mentions/search?${params}`;
          break;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();

      switch (type) {
        case "tag":
          setItems(data.tags || []);
          break;
        case "wikiLink":
          setItems(data.documents || []);
          break;
        case "mention":
          setItems(data.mentions || []);
          break;
      }
    } catch (error) {
      console.error("Autocomplete fetch error:", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [type, query, dataRoomId]);

  // Fetch on mount and query change
  useEffect(() => {
    const timer = setTimeout(fetchResults, 150); // Debounce
    return () => clearTimeout(timer);
  }, [fetchResults]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          if (items[selectedIndex]) {
            onSelect(items[selectedIndex]);
          }
          break;
        case "Escape":
          onClose();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedIndex, onSelect, onClose]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const getIcon = (item: AutocompleteItem) => {
    switch (type) {
      case "tag":
        return <Hash className="h-4 w-4" style={{ color: item.color }} />;
      case "wikiLink":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "mention":
        return item.type === "team" ? (
          <Users className="h-4 w-4 text-purple-500" />
        ) : (
          <User className="h-4 w-4 text-green-500" />
        );
    }
  };

  const getLabel = (item: AutocompleteItem) => {
    switch (type) {
      case "tag":
        return `#${item.name}`;
      case "wikiLink":
        return item.title;
      case "mention": {
        const needsParens = item.name && /[\s]/.test(item.name);
        const displayName = needsParens ? `(${item.name})` : item.name;
        return item.type === "team" ? `@team:${displayName}` : `@${displayName}`;
      }
    }
  };

  const getSubLabel = (item: AutocompleteItem) => {
    switch (type) {
      case "tag":
        return item.count ? `${item.count} docs` : "";
      case "wikiLink":
        return item.tags?.join(", ") || "";
      case "mention":
        return item.email || "";
    }
  };

  // Create new item option for wiki links
  const showCreateOption = type === "wikiLink" && query && !items.some(
    (item) => item.title?.toLowerCase() === query.toLowerCase()
  );

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-popover border rounded-md shadow-lg overflow-hidden min-w-[200px] max-w-[300px]"
      style={{
        top: position.top + 4,
        left: position.left,
      }}
      data-testid="autocomplete-popup"
    >
      {loading ? (
        <div className="p-3 text-sm text-muted-foreground">Loading...</div>
      ) : items.length === 0 && !showCreateOption ? (
        <div className="p-3 text-sm text-muted-foreground">
          No results found
        </div>
      ) : (
        <ul className="py-1 max-h-[300px] overflow-auto">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer",
                index === selectedIndex && "bg-accent"
              )}
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
              data-testid={`autocomplete-item-${index}`}
            >
              {getIcon(item)}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {getLabel(item)}
                </div>
                {getSubLabel(item) && (
                  <div className="text-xs text-muted-foreground truncate">
                    {getSubLabel(item)}
                  </div>
                )}
              </div>
            </li>
          ))}

          {showCreateOption && (
            <li
              className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer border-t",
                items.length === selectedIndex && "bg-accent"
              )}
              onClick={() =>
                onSelect({ id: "new", title: query, isNew: true })
              }
              onMouseEnter={() => setSelectedIndex(items.length)}
              data-testid="autocomplete-create-new"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                Create <strong>[[{query}]]</strong>
              </div>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default AutocompletePopup;
