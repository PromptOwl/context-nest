import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Match [ ] (unchecked) and [x] or [X] (checked) task checkboxes
const taskCheckboxRegex = /\[([ xX])\]/g;

export const TaskCheckbox = Extension.create({
  name: "taskCheckbox",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("taskCheckbox"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;

              const text = node.text;
              let match;

              taskCheckboxRegex.lastIndex = 0;
              while ((match = taskCheckboxRegex.exec(text)) !== null) {
                const isChecked = match[1] === "x" || match[1] === "X";
                const start = pos + match.index;
                const end = start + match[0].length;

                decorations.push(
                  Decoration.inline(start, end, {
                    class: `task-checkbox ${isChecked ? "task-checked" : "task-unchecked"}`,
                    "data-task-checked": isChecked ? "true" : "false",
                  })
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
          handleClick(view, pos, event) {
            const target = event.target as HTMLElement;
            if (!target.classList.contains("task-checkbox")) return false;

            const isChecked = target.getAttribute("data-task-checked") === "true";
            const { state } = view;
            const { doc } = state;

            // Find the decoration range at the click position
            let found = false;
            doc.descendants((node, nodePos) => {
              if (found || !node.isText || !node.text) return;

              const text = node.text;
              let match;

              taskCheckboxRegex.lastIndex = 0;
              while ((match = taskCheckboxRegex.exec(text)) !== null) {
                const start = nodePos + match.index;
                const end = start + match[0].length;

                if (pos >= start && pos <= end) {
                  // Toggle the checkbox
                  const replacement = isChecked ? "[ ]" : "[x]";
                  const tr = state.tr.replaceWith(
                    start,
                    end,
                    state.schema.text(replacement)
                  );
                  view.dispatch(tr);
                  found = true;
                  return false;
                }
              }
            });

            return found;
          },
        },
      }),
    ];
  },
});

export default TaskCheckbox;
