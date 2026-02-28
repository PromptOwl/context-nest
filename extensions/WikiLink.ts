import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface WikiLinkOptions {
  onWikiLinkClick?: (title: string, id: string | null) => void;
  checkExists?: (title: string) => Promise<{ exists: boolean; id?: string }>;
}

// Match [[wiki link]] or [[wiki link|display text]]
const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

// Cache for document existence checks
const existsCache = new Map<string, { exists: boolean; id?: string }>();

export const WikiLink = Extension.create<WikiLinkOptions>({
  name: "wikiLink",

  addOptions() {
    return {
      onWikiLinkClick: undefined,
      checkExists: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { onWikiLinkClick, checkExists } = this.options;

    return [
      new Plugin({
        key: new PluginKey("wikiLink"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;

              const text = node.text;
              let match;

              wikiLinkRegex.lastIndex = 0;
              while ((match = wikiLinkRegex.exec(text)) !== null) {
                const fullMatch = match[0];
                const title = match[1].trim();
                const displayText = match[2]?.trim() || title;
                const start = pos + match.index;

                // Check cache for existence
                const cached = existsCache.get(title.toLowerCase());
                const exists = cached?.exists ?? false;
                const docId = cached?.id;

                const linkClass = exists ? "wiki-link-exists" : "wiki-link-broken";
                const tooltip = exists
                  ? `Open "${title}"`
                  : `Create "${title}" (page doesn't exist yet)`;

                // Create 3 decorations: opening brackets (hidden), link text, closing brackets (hidden)
                const openBracketEnd = start + 2; // [[
                const closeBracketStart = start + fullMatch.length - 2; // ]]

                // Hide opening [[
                decorations.push(
                  Decoration.inline(start, openBracketEnd, {
                    class: "wiki-bracket-hidden",
                  })
                );

                // Style the link text (including | if present)
                decorations.push(
                  Decoration.inline(openBracketEnd, closeBracketStart, {
                    class: `wiki-link ${linkClass}`,
                    "data-wiki-title": title,
                    "data-wiki-id": docId || "",
                    "data-wiki-display": displayText,
                    title: tooltip,
                  })
                );

                // Hide closing ]]
                decorations.push(
                  Decoration.inline(closeBracketStart, start + fullMatch.length, {
                    class: "wiki-bracket-hidden",
                  })
                );

                // Async check existence and update cache
                if (checkExists && !existsCache.has(title.toLowerCase())) {
                  existsCache.set(title.toLowerCase(), { exists: false });
                  checkExists(title).then((result) => {
                    existsCache.set(title.toLowerCase(), result);
                  });
                }
              }
            });

            return DecorationSet.create(doc, decorations);
          },
          handleClick(view, pos, event) {
            const target = event.target as HTMLElement;
            if (target.classList.contains("wiki-link")) {
              const title = target.getAttribute("data-wiki-title");
              const id = target.getAttribute("data-wiki-id") || null;
              if (title && onWikiLinkClick) {
                onWikiLinkClick(title, id);
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

export default WikiLink;
