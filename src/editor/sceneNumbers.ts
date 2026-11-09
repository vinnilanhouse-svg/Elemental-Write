import type { Node } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export function sceneNumberDecorations(doc: Node) {
  const decorations: Decoration[] = [];
  let number = 0;
  doc.forEach((node, pos) => {
    if (node.attrs.kind !== "scene") return;
    const label = String(++number);
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, { "data-scene-number": label }),
      Decoration.widget(
        pos + 1,
        () => {
          const badge = document.createElement("span");
          badge.className = "scene-number";
          badge.contentEditable = "false";
          badge.textContent = label;
          badge.setAttribute("aria-label", `Cena ${label}`);
          return badge;
        },
        { side: 1, key: `scene-${label}`, ignoreSelection: true },
      ),
    );
  });
  return DecorationSet.create(doc, decorations);
}

// Derived from document order; no stored counters or extra undo steps.
export const sceneNumbers = () =>
  new Plugin<DecorationSet>({
    state: {
      init: (_, state) => sceneNumberDecorations(state.doc),
      apply: (tr, previous) =>
        tr.docChanged ? sceneNumberDecorations(tr.doc) : previous,
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
