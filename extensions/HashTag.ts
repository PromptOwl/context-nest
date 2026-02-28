import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface HashTagOptions {
  onHashTagClick?: (tag: string) => void;
}

// Match #hashtag pattern (word characters after #, not inside a word)
const hashTagRegex = /(?:^|\s)#([a-zA-Z0-9_-]+)/g;

export const HashTag = Extension.create<HashTagOptions>({
  name: "hashTag",

  addOptions() {
    return {
      onHashTagClick: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { onHashTagClick } = this.options;

    return [
      new Plugin({
        key: new PluginKey("hashTag"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;

              const text = node.text;
              let match;

              hashTagRegex.lastIndex = 0;
              while ((match = hashTagRegex.exec(text)) !== null) {
                // Calculate the actual start of #tag (skip leading whitespace)
                const fullMatch = match[0];
                const tag = match[1];
                const leadingSpace = fullMatch.startsWith(" ") || fullMatch.startsWith("\n") ? 1 : 0;
                const start = pos + match.index + leadingSpace;
                const end = start + tag.length + 1; // +1 for the #

                decorations.push(
                  Decoration.inline(start, end, {
                    class: "hashtag",
                    "data-tag": tag,
                  })
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
          handleClick(view, pos, event) {
            const target = event.target as HTMLElement;
            if (target.classList.contains("hashtag")) {
              const tag = target.getAttribute("data-tag");
              if (tag && onHashTagClick) {
                onHashTagClick(tag);
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

export default HashTag;
