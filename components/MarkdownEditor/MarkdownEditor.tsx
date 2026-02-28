"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { WikiLink } from "./extensions/WikiLink";
import { HashTag } from "./extensions/HashTag";
import { Mention } from "./extensions/Mention";
import { TaskCheckbox } from "./extensions/TaskCheckbox";
import { EditorToolbar } from "./EditorToolbar";
import { AutocompletePopup } from "./AutocompletePopup";
import { AddTaskModal } from "./AddTaskModal";
import { cn } from "@/lib/utils";

// Check if a document exists by title
async function checkDocumentExists(title: string): Promise<{ exists: boolean; id?: string }> {
  try {
    const params = new URLSearchParams({ q: title, limit: "1" });
    const res = await fetch(`/api/data-room/documents/search?${params}`);
    if (!res.ok) return { exists: false };
    const data = await res.json();
    const exactMatch = data.documents?.find(
      (d: { title: string; id: string }) => d.title.toLowerCase() === title.toLowerCase()
    );
    return exactMatch ? { exists: true, id: exactMatch.id } : { exists: false };
  } catch {
    return { exists: false };
  }
}

export interface MentionData {
  type: "user" | "team";
  id: string;
  name: string;
}

export interface TaskData {
  id?: string;
  text: string;
  completed: boolean;
  assigneeId?: string;
  assigneeName?: string;
}

export interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  placeholder?: string;
  editable?: boolean;
  dataRoomId?: string;
  onWikiLinkClick?: (title: string, id: string | null) => void;
  onHashTagClick?: (tag: string) => void;
  onMentionClick?: (type: "user" | "team", name: string) => void;
  onMentionNeedsAccess?: (userId: string, userName: string) => void;
  onMentionSelect?: (mention: MentionData) => void;
  onMentionRemove?: (mentionName: string) => void;
  onTaskAdd?: (task: TaskData) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<TaskData>) => void;
  onTaskRemove?: (taskId: string) => void;
  onTasksSync?: (tasks: TaskData[]) => void;
  tasks?: TaskData[];
  className?: string;
}

type AutocompleteType = "tag" | "wikiLink" | "mention" | null;

interface AutocompleteState {
  type: AutocompleteType;
  query: string;
  position: { top: number; left: number };
}

// Parse tasks from HTML content
function parseTasksFromHtml(html: string): Array<{ text: string; completed: boolean; assigneeName?: string }> {
  const tasks: Array<{ text: string; completed: boolean; assigneeName?: string }> = [];

  // Match task items: <li data-checked="true/false" data-type="taskItem">content</li>
  // Also match: <input type="checkbox" checked> style tasks
  const taskRegex = /<li[^>]*data-type="taskItem"[^>]*data-checked="(true|false)"[^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = taskRegex.exec(html)) !== null) {
    const completed = match[1] === "true";
    // Strip HTML tags from content to get text
    let text = match[2].replace(/<[^>]*>/g, " ").trim();

    // Extract assignee mention if present (@name or @(name with spaces))
    let assigneeName: string | undefined;
    const mentionMatch = text.match(/@\(([^)]+)\)|@([a-zA-Z0-9._-]+)/);
    if (mentionMatch) {
      assigneeName = mentionMatch[1] || mentionMatch[2];
      // Remove mention from text
      text = text.replace(/@\([^)]+\)|@[a-zA-Z0-9._-]+/, "").trim();
    }

    if (text) {
      tasks.push({ text, completed, assigneeName });
    }
  }

  // Also check for markdown-style tasks: - [ ] or - [x]
  const mdTaskRegex = /\[([ x])\]\s*([^\n<]+)/gi;
  while ((match = mdTaskRegex.exec(html)) !== null) {
    const completed = match[1].toLowerCase() === "x";
    let text = match[2].replace(/<[^>]*>/g, " ").trim();

    // Check if this task wasn't already captured
    if (text && !tasks.some(t => t.text === text)) {
      let assigneeName: string | undefined;
      const mentionMatch = text.match(/@\(([^)]+)\)|@([a-zA-Z0-9._-]+)/);
      if (mentionMatch) {
        assigneeName = mentionMatch[1] || mentionMatch[2];
        text = text.replace(/@\([^)]+\)|@[a-zA-Z0-9._-]+/, "").trim();
      }

      if (text) {
        tasks.push({ text, completed, assigneeName });
      }
    }
  }

  return tasks;
}

export function MarkdownEditor({
  content,
  onChange,
  onSave,
  placeholder = "Start writing...",
  editable = true,
  dataRoomId,
  onWikiLinkClick,
  onHashTagClick,
  onMentionClick,
  onMentionNeedsAccess,
  onMentionSelect,
  onMentionRemove,
  onTaskAdd,
  onTaskUpdate,
  onTaskRemove,
  onTasksSync,
  tasks: externalTasks,
  className,
}: MarkdownEditorProps) {
  const [autocomplete, setAutocomplete] = useState<AutocompleteState | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: false,
      }),
      WikiLink.configure({
        onWikiLinkClick,
        checkExists: checkDocumentExists,
      }),
      HashTag.configure({
        onHashTagClick,
      }),
      Mention.configure({
        onMentionClick,
      }),
      TaskCheckbox,
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      checkForAutocomplete(editor);

      // Sync tasks from content to external state
      if (onTasksSync && externalTasks) {
        const parsedTasks = parseTasksFromHtml(html);

        // Track which external tasks have been matched
        const matchedIds = new Set<string>();

        // Match parsed tasks with external tasks - first by exact text, then by position
        const syncedTasks: TaskData[] = parsedTasks.map((parsed, index) => {
          // First try exact text match
          let existing = externalTasks.find(
            (t) => !matchedIds.has(t.id || '') && t.text.toLowerCase().trim() === parsed.text.toLowerCase().trim()
          );

          // If no exact match and same position exists, use position-based match
          // This handles text edits while preserving the task ID
          if (!existing && index < externalTasks.length) {
            const positionMatch = externalTasks[index];
            if (positionMatch && positionMatch.id && !matchedIds.has(positionMatch.id)) {
              existing = positionMatch;
            }
          }

          if (existing && existing.id) {
            matchedIds.add(existing.id);
            // Update existing task - preserve ID and assigneeId
            return {
              id: existing.id,
              text: parsed.text,
              completed: parsed.completed,
              assigneeId: existing.assigneeId,
              assigneeName: parsed.assigneeName || existing.assigneeName,
            };
          } else {
            // New task from content (no ID yet - will be assigned on save)
            return {
              text: parsed.text,
              completed: parsed.completed,
              assigneeName: parsed.assigneeName,
            };
          }
        });

        // Only sync if tasks actually changed
        const tasksChanged =
          syncedTasks.length !== externalTasks.length ||
          syncedTasks.some((t, i) => {
            const ext = externalTasks[i];
            return !ext || t.text !== ext.text || t.completed !== ext.completed;
          });

        if (tasksChanged) {
          onTasksSync(syncedTasks);
        }
      }
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-6 py-4",
      },
      handleKeyDown: (view, event) => {
        // Handle autocomplete selection
        if (autocomplete && (event.key === "Enter" || event.key === "Tab")) {
          // Let autocomplete handle it
          return false;
        }

        // Ctrl/Cmd + S to save
        if ((event.ctrlKey || event.metaKey) && event.key === "s") {
          event.preventDefault();
          onSave?.();
          return true;
        }

        return false;
      },
    },
  });

  // Check if we should show autocomplete
  const checkForAutocomplete = useCallback((editor: Editor) => {
    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;

    // Get text before cursor
    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

    // Check for [[ (wiki link)
    const wikiMatch = textBefore.match(/\[\[([^\]]*)?$/);
    if (wikiMatch) {
      const coords = editor.view.coordsAtPos($from.pos);
      setAutocomplete({
        type: "wikiLink",
        query: wikiMatch[1] || "",
        position: { top: coords.bottom, left: coords.left },
      });
      return;
    }

    // Check for # (hashtag)
    const tagMatch = textBefore.match(/#([a-zA-Z0-9_-]*)$/);
    if (tagMatch) {
      const coords = editor.view.coordsAtPos($from.pos);
      setAutocomplete({
        type: "tag",
        query: tagMatch[1] || "",
        position: { top: coords.bottom, left: coords.left },
      });
      return;
    }

    // Check for @ (mention)
    const mentionMatch = textBefore.match(/@([a-zA-Z0-9._@-]*)$/);
    if (mentionMatch) {
      const coords = editor.view.coordsAtPos($from.pos);
      setAutocomplete({
        type: "mention",
        query: mentionMatch[1] || "",
        position: { top: coords.bottom, left: coords.left },
      });
      return;
    }

    // No autocomplete needed
    setAutocomplete(null);
  }, []);

  // Handle autocomplete selection
  const handleAutocompleteSelect = useCallback(
    (item: any) => {
      if (!editor || !autocomplete) return;

      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;

      // Calculate how much text to replace
      let deleteCount = 0;
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

      if (autocomplete.type === "wikiLink") {
        const match = textBefore.match(/\[\[([^\]]*)?$/);
        deleteCount = match ? match[0].length : 0;

        editor
          .chain()
          .focus()
          .deleteRange({
            from: $from.pos - deleteCount,
            to: $from.pos,
          })
          .insertContent(`[[${item.title}]]`)
          .run();
      } else if (autocomplete.type === "tag") {
        const match = textBefore.match(/#([a-zA-Z0-9_-]*)$/);
        deleteCount = match ? match[0].length : 0;

        editor
          .chain()
          .focus()
          .deleteRange({
            from: $from.pos - deleteCount,
            to: $from.pos,
          })
          .insertContent(`#${item.name} `)
          .run();
      } else if (autocomplete.type === "mention") {
        const match = textBefore.match(/@([a-zA-Z0-9._@-]*)$/);
        deleteCount = match ? match[0].length : 0;

        // Use parentheses for names containing spaces or special characters
        const needsParens = /[\s]/.test(item.name);
        const wrappedName = needsParens ? `(${item.name})` : item.name;
        const prefix = item.type === "team" ? "@team:" : "@";
        editor
          .chain()
          .focus()
          .deleteRange({
            from: $from.pos - deleteCount,
            to: $from.pos,
          })
          .insertContent(`${prefix}${wrappedName} `)
          .run();

        // Notify parent about the selected mention with ID
        if (onMentionSelect && item.id) {
          onMentionSelect({
            type: item.type,
            id: item.id,
            name: item.name,
          });
        }

        // Check if mention needs access
        if (item.needsAccess && onMentionNeedsAccess) {
          onMentionNeedsAccess(item.id, item.name);
        }
      }

      setAutocomplete(null);
    },
    [editor, autocomplete, onMentionNeedsAccess, onMentionSelect]
  );

  // Close autocomplete on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && autocomplete) {
        setAutocomplete(null);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [autocomplete]);

  // Update editor editable state when prop changes
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Handle adding a task from the modal
  const handleAddTask = useCallback(
    (task: { text: string; completed: boolean; assignee: { id: string; type: "user" | "team"; name: string } | null }) => {
      if (!editor) return;

      const checkMark = task.completed ? "x" : " ";
      let taskContent = `[${checkMark}] ${task.text}`;

      // Add assignee mention if present (only users can be assignees)
      if (task.assignee && task.assignee.type === "user") {
        const needsParens = /[\s]/.test(task.assignee.name);
        const wrappedName = needsParens ? `(${task.assignee.name})` : task.assignee.name;
        taskContent += ` @${wrappedName}`;

        // Track the task with assignee ID for saving
        if (onTaskAdd) {
          onTaskAdd({
            text: task.text,
            completed: task.completed,
            assigneeId: task.assignee.id,
            assigneeName: task.assignee.name,
          });
        }
      } else {
        // Track task without assignee
        if (onTaskAdd) {
          onTaskAdd({
            text: task.text,
            completed: task.completed,
          });
        }
      }

      editor.chain().focus().insertContent(taskContent + " ").run();
    },
    [editor, onTaskAdd]
  );

  if (!editor) {
    return (
      <div className="border rounded-lg bg-background shadow-sm">
        <div className="h-12 bg-muted/40 rounded-t-lg border-b" />
        <div className="animate-pulse bg-muted/20 h-[300px] rounded-b-lg" />
      </div>
    );
  }

  return (
    <div className={cn("relative border rounded-lg bg-background shadow-sm", className)}>
      {editable && (
        <EditorToolbar
          editor={editor}
          onAddTask={() => setShowAddTaskModal(true)}
        />
      )}

      <EditorContent
        editor={editor}
        className="min-h-[300px]"
        data-testid="markdown-editor-content"
      />

      {autocomplete && (
        <AutocompletePopup
          type={autocomplete.type!}
          query={autocomplete.query}
          position={autocomplete.position}
          dataRoomId={dataRoomId}
          onSelect={handleAutocompleteSelect}
          onClose={() => setAutocomplete(null)}
        />
      )}

      <AddTaskModal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        onAdd={handleAddTask}
      />
    </div>
  );
}

export default MarkdownEditor;
