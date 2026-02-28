import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface MentionOptions {
  onMentionClick?: (type: "user" | "team", name: string) => void;
}

// Match @username, @(Full Name), @team:teamname, or @team:(Team Name)
const mentionRegex = /(?:^|\s)@(team:)?(?:\(([^)]+)\)|([a-zA-Z0-9._@-]+))/g;

export const Mention = Extension.create<MentionOptions>({
  name: "mention",

  addOptions() {
    return {
      onMentionClick: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { onMentionClick } = this.options;

    return [
      new Plugin({
        key: new PluginKey("mention"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;

              const text = node.text;
              let match;

              mentionRegex.lastIndex = 0;
              while ((match = mentionRegex.exec(text)) !== null) {
                const fullMatch = match[0];
                const isTeam = !!match[1];
                const name = match[2] || match[3]; // group 2 = parenthesized, group 3 = simple
                const leadingSpace = fullMatch.startsWith(" ") || fullMatch.startsWith("\n") ? 1 : 0;
                const start = pos + match.index + leadingSpace;
                const end = start + fullMatch.length - leadingSpace;
                const type = isTeam ? "team" : "user";

                decorations.push(
                  Decoration.inline(start, end, {
                    class: `mention mention-${type}`,
                    "data-mention-type": type,
                    "data-mention-name": name,
                  })
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
          handleClick(view, pos, event) {
            const target = event.target as HTMLElement;
            if (target.classList.contains("mention")) {
              const type = target.getAttribute("data-mention-type") as "user" | "team";
              const name = target.getAttribute("data-mention-name");
              if (type && name && onMentionClick) {
                onMentionClick(type, name);
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});

export default Mention;
