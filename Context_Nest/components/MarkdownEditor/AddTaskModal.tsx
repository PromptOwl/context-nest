"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { CheckSquare, Loader2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AssigneeItem {
  id: string;
  type: "user" | "team";
  name: string;
  email?: string;
}

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: { text: string; completed: boolean; assignee: AssigneeItem | null }) => void;
}

export function AddTaskModal({ isOpen, onClose, onAdd }: AddTaskModalProps) {
  const [taskText, setTaskText] = useState("");
  const [completed, setCompleted] = useState(false);
  const [assignee, setAssignee] = useState<AssigneeItem | null>(null);
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [assigneeResults, setAssigneeResults] = useState<AssigneeItem[]>([]);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const assigneeInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTaskText("");
      setCompleted(false);
      setAssignee(null);
      setAssigneeQuery("");
      setAssigneeResults([]);
      setShowAssigneeDropdown(false);
    }
  }, [isOpen]);

  // Search for assignees (users only - teams cannot be assignees)
  const searchAssignees = useCallback(async (query: string) => {
    if (!query.trim()) {
      setAssigneeResults([]);
      setShowAssigneeDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, limit: "10", type: "user" });
      const res = await fetch(`/api/data-room/mentions/search?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      // Filter to only include users (in case API doesn't filter)
      const users = (data.mentions || []).filter((m: AssigneeItem) => m.type === "user");
      setAssigneeResults(users);
      setShowAssigneeDropdown(true);
      setSelectedIndex(0);
    } catch (error) {
      console.error("Assignee search error:", error);
      setAssigneeResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchAssignees(assigneeQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [assigneeQuery, searchAssignees]);

  // Handle keyboard navigation in dropdown
  const handleAssigneeKeyDown = (e: React.KeyboardEvent) => {
    if (!showAssigneeDropdown || assigneeResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, assigneeResults.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (assigneeResults[selectedIndex]) {
          selectAssignee(assigneeResults[selectedIndex]);
        }
        break;
      case "Escape":
        setShowAssigneeDropdown(false);
        break;
    }
  };

  const selectAssignee = (item: AssigneeItem) => {
    setAssignee(item);
    setAssigneeQuery("");
    setShowAssigneeDropdown(false);
  };

  const removeAssignee = () => {
    setAssignee(null);
  };

  const handleSubmit = () => {
    if (!taskText.trim()) return;

    onAdd({
      text: taskText.trim(),
      completed,
      assignee,
    });
    onClose();
  };

  // Click outside dropdown to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        assigneeInputRef.current &&
        !assigneeInputRef.current.contains(e.target as Node)
      ) {
        setShowAssigneeDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="add-task-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Add Task
          </DialogTitle>
          <DialogDescription>
            Create a new task with optional assignee.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Task text input */}
          <div className="space-y-2">
            <label htmlFor="task-text" className="text-sm font-medium">
              Task description
            </label>
            <Input
              id="task-text"
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              placeholder="What needs to be done?"
              data-testid="task-text-input"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>

          {/* Completed checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="task-completed"
              checked={completed}
              onCheckedChange={(checked) => setCompleted(checked === true)}
              data-testid="task-completed-checkbox"
            />
            <label htmlFor="task-completed" className="text-sm">
              Mark as completed
            </label>
          </div>

          {/* Assignee search */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Assign to (optional)
            </label>

            {assignee ? (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <User className="h-4 w-4 text-green-500" />
                <span className="flex-1 text-sm">@{assignee.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={removeAssignee}
                  data-testid="remove-assignee-button"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Input
                    ref={assigneeInputRef}
                    value={assigneeQuery}
                    onChange={(e) => setAssigneeQuery(e.target.value)}
                    onFocus={() => {
                      if (assigneeQuery && assigneeResults.length > 0) {
                        setShowAssigneeDropdown(true);
                      }
                    }}
                    onKeyDown={handleAssigneeKeyDown}
                    placeholder="Search users..."
                    className={loading ? "pr-8" : ""}
                    data-testid="assignee-search-input"
                  />
                  {loading && (
                    <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {/* Assignee dropdown */}
                {showAssigneeDropdown && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg overflow-hidden"
                    data-testid="assignee-dropdown"
                  >
                    {loading ? (
                      <div className="p-3 text-sm text-muted-foreground">
                        Loading...
                      </div>
                    ) : assigneeResults.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">
                        No results found
                      </div>
                    ) : (
                      <ul className="py-1 max-h-[200px] overflow-auto">
                        {assigneeResults.map((item, index) => (
                          <li
                            key={item.id}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 cursor-pointer",
                              index === selectedIndex && "bg-accent"
                            )}
                            onClick={() => selectAssignee(item)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            data-testid={`assignee-item-${index}`}
                          >
                            <User className="h-4 w-4 text-green-500" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                @{item.name}
                              </div>
                              {item.email && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {item.email}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="cancel-task-button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!taskText.trim()}
            data-testid="add-task-button"
          >
            Add Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddTaskModal;
