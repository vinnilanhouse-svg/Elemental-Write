import { Schema } from "prosemirror-model";
import { Plugin, TextSelection, type Command } from "prosemirror-state";
import { splitBlock, baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { history, undo, redo } from "prosemirror-history";
import { kinds, nextKind, normalizeKind, type Kind } from "../model";
export const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    block: {
      content: "inline*",
      group: "block",
      attrs: { kind: { default: "action" } },
      parseDOM: [
        {
          tag: "p",
          getAttrs: (el) => ({
            kind: (el as HTMLElement).dataset.kind || "action",
          }),
        },
      ],
      toDOM: (n) => ["p", { "data-kind": n.attrs.kind }, 0],
    },
    text: { group: "inline" },
    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM: () => ["br"],
    },
  },
  marks: {
    bold: {
      parseDOM: [{ tag: "strong" }, { tag: "b" }],
      toDOM: () => ["strong", 0],
    },
    italic: { parseDOM: [{ tag: "em" }, { tag: "i" }], toDOM: () => ["em", 0] },
    underline: { parseDOM: [{ tag: "u" }], toDOM: () => ["u", 0] },
  },
});
export const setKind =
  (kind: Kind): Command =>
  (state, dispatch) => {
    const { $from } = state.selection;
    if ($from.depth !== 1) return false;
    const start = $from.start();
    const end = $from.end();
    const text = $from.parent.textBetween(
      0,
      $from.parent.content.size,
      "",
      "\n",
    );
    const tr = state.tr.setNodeMarkup($from.before(), undefined, { kind });
    if (kind === "parenthetical") {
      // Insert around the existing content so marks and hard breaks survive.
      const trimmed = text.trim();
      if (!trimmed.endsWith(")")) tr.insertText(")", end);
      if (!trimmed.startsWith("(")) tr.insertText("(", start);
      if (state.selection.$from.sameParent(state.selection.$to)) {
        const node = tr.doc.nodeAt($from.before())!;
        const content = node.textBetween(0, node.content.size, "", "\n");
        const insideStart = start + content.indexOf("(") + 1;
        const insideEnd = start + content.lastIndexOf(")");
        const clamp = (pos: number) =>
          Math.max(insideStart, Math.min(insideEnd, pos));
        tr.setSelection(
          TextSelection.create(
            tr.doc,
            clamp(tr.selection.anchor),
            clamp(tr.selection.head),
          ),
        );
      }
    } else if (
      $from.parent.attrs.kind === "parenthetical" &&
      /^\(\s*\)$/.test(text)
    ) {
      tr.delete(start, end);
    }
    dispatch?.(tr.scrollIntoView());
    return true;
  };
export const cycleKind =
  (direction: number): Command =>
  (state, dispatch) => {
    const current = state.selection.$from.parent.attrs.kind as Kind;
    return setKind(
      kinds[(kinds.indexOf(current) + direction + kinds.length) % kinds.length],
    )(state, dispatch);
  };
export const enter: Command = (state, dispatch) => {
  const { $from } = state.selection;
  const kind = $from.parent.attrs.kind as Kind;
  if (kind === "character" && !$from.parent.textContent.trim())
    return setKind("action")(state, dispatch);
  if (
    kind === "parenthetical" &&
    state.selection.empty &&
    /^\)\s*$/.test(
      $from.parent.textBetween(
        $from.parentOffset,
        $from.parent.content.size,
        "",
        "\n",
      ),
    )
  ) {
    // Enter after the inner text leaves the closing parenthesis in this block.
    const tr = state.tr.setSelection(
      TextSelection.create(state.doc, $from.end()),
    );
    tr.split($from.end(), 1, [
      { type: schema.nodes.block, attrs: { kind: "dialogue" } },
    ]);
    dispatch?.(tr.scrollIntoView());
    return true;
  }
  let result = state.tr;
  const ok = splitBlock(state, (tr) => {
    result = tr;
  });
  if (!ok) return false;
  const pos = result.selection.$from.before();
  result.setNodeMarkup(pos, undefined, { kind: nextKind[kind] });
  dispatch?.(result.scrollIntoView());
  return true;
};
export const backspaceEmpty: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (
    empty &&
    $from.parent.attrs.kind === "parenthetical" &&
    $from.parentOffset <= 1 &&
    /^\(\s*\)$/.test(
      $from.parent.textBetween(0, $from.parent.content.size, "", "\n"),
    )
  ) {
    return setKind("action")(state, dispatch);
  }
  if (
    empty &&
    $from.parentOffset === 0 &&
    $from.parent.content.size === 0 &&
    $from.parent.attrs.kind !== "action"
  )
    return setKind("action")(state, dispatch);
  return false;
};
export const hardBreak: Command = (state, dispatch) => {
  dispatch?.(
    state.tr
      .replaceSelectionWith(schema.nodes.hard_break.create())
      .scrollIntoView(),
  );
  return true;
};
export const editorPlugins = () => [
  history(),
  keymap({
    Enter: enter,
    "Shift-Enter": hardBreak,
    Tab: cycleKind(1),
    "Shift-Tab": cycleKind(-1),
    Backspace: backspaceEmpty,
    "Mod-z": undo,
    "Mod-Shift-z": redo,
    "Mod-y": redo,
  }),
  keymap(baseKeymap),
  new Plugin({
    appendTransaction: (transactions, _old, state) => {
      if (!transactions.some((t) => t.docChanged)) return null;
      const tr = state.tr;
      state.doc.forEach((node, pos) => {
        const kind = node.attrs.kind as Kind;
        const next = normalizeKind(kind, node.textContent);
        if (next !== kind) tr.setNodeMarkup(pos, undefined, { kind: next });
      });
      return tr.docChanged ? tr : null;
    },
  }),
];
