import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  EditorState,
  TextSelection,
  Plugin,
  PluginKey,
} from "prosemirror-state";
import { EditorView, Decoration, DecorationSet } from "prosemirror-view";
import { undo, redo } from "prosemirror-history";
import { toggleMark } from "prosemirror-commands";
import { schema, editorPlugins, setKind, setShot } from "./schema";
import { shots, shotPrefix, type ShotId } from "../shots";
import {
  characters,
  kinds,
  labels,
  type ScriptDoc,
  type Kind,
  type Manuscript,
} from "../model";
import { layout, indents, wrap, characterWidth } from "./layout";
export type EditorHandle = {
  focus: () => void;
  command: (name: string) => void;
  kind: (kind: Kind) => void;
  shot: (id: ShotId) => void;
  currentShot: () => ShotId | null;
  scene: (index: number) => void;
  search: (query: string) => number;
  nextMatch: () => void;
};
type Props = {
  doc: ScriptDoc;
  paper: Manuscript["paper"];
  onChange: (doc: ScriptDoc) => void;
  onKind: (kind: Kind) => void;
  onPages: (pages: number) => void;
  onHighlightChange?: (active: boolean) => void;
  onShotRequest?: () => void;
};
const isHighlighted = (state: EditorState) =>
  state.selection.empty
    ? (state.storedMarks ?? state.selection.$from.marks()).some(
        (mark) => mark.type === schema.marks.highlight,
      )
    : state.doc.rangeHasMark(
        state.selection.from,
        state.selection.to,
        schema.marks.highlight,
      );
const searchKey = new PluginKey("search");
export const ScreenplayEditor = forwardRef<EditorHandle, Props>(
  function ScreenplayEditor(props, ref) {
    const host = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const callbacks = useRef(props);
    callbacks.current = props;
    const [suggestion, setSuggestion] = useState<{
      names: string[];
      active: number;
      x: number;
      y: number;
    } | null>(null);
    const suggestRef = useRef(suggestion);
    suggestRef.current = suggestion;
    const dismissed = useRef(false);
    const queryRef = useRef("");
    const matches = useRef<number[]>([]);
    const matchIndex = useRef(-1);
    const accept = (name: string) => {
      const view = viewRef.current;
      if (!view) return;
      const { $from } = view.state.selection;
      const start = $from.start();
      view.dispatch(
        view.state.tr.insertText(
          name,
          start,
          start + $from.parent.content.size,
        ),
      );
      dismissed.current = true;
      setSuggestion(null);
      view.focus();
    };
    useEffect(() => {
      if (!host.current) return;
      const decorations = new Plugin({
        key: searchKey,
        props: {
          decorations(state) {
            const result: Decoration[] = [];
            const q = queryRef.current.toLocaleLowerCase("pt-BR");
            if (q)
              state.doc.descendants((node, pos) => {
                if (node.isText) {
                  const text = node.text!.toLocaleLowerCase("pt-BR");
                  let i = 0;
                  while ((i = text.indexOf(q, i)) >= 0) {
                    result.push(
                      Decoration.inline(pos + i, pos + i + q.length, {
                        class: "search-result",
                      }),
                    );
                    i += q.length;
                  }
                }
              });
            return DecorationSet.create(state.doc, result);
          },
        },
      });
      const pagePlugin = new Plugin({
        props: {
          decorations(state) {
            const doc = state.doc.toJSON() as ScriptDoc;
            const planned = layout(doc.content, callbacks.current.paper);
            const offsets: number[] = [];
            state.doc.forEach((_n, pos) => offsets.push(pos + 1));
            const result: Decoration[] = [];
            let page = 1,
              inserted = 0,
              natural = 0;
            const starts: number[] = [];
            for (const b of doc.content) {
              starts.push(natural);
              const st = indents[b.attrs.kind];
              natural +=
                wrap(
                  b.content
                    ?.map((s) => (s.type === "text" ? s.text : "\n"))
                    .join("") || "",
                  Math.max(
                    8,
                    Math.floor(
                      (planned.geometry.width -
                        planned.geometry.left -
                        planned.geometry.right -
                        st.left -
                        st.right) /
                        characterWidth,
                    ),
                  ),
                ).length *
                  planned.geometry.line +
                st.after;
            }
            const rowsSeen = new Map<number, number>();
            for (const line of planned.lines) {
              const row = rowsSeen.get(line.blockIndex) || 0;
              rowsSeen.set(line.blockIndex, row + 1);
              if (line.page > page) {
                page = line.page;
                const number = page;
                const pos = offsets[line.blockIndex] + line.start;
                const raw =
                  ((starts[line.blockIndex] + row * planned.geometry.line) *
                    4) /
                  3;
                const current = raw + inserted;
                const target =
                  (((page - 1) * (planned.geometry.height + 18) +
                    line.y -
                    planned.geometry.top) *
                    4) /
                  3;
                const gap = Math.max(0, target - current);
                const breakAt =
                  (((page - 2) * (planned.geometry.height + 18) +
                    planned.geometry.height -
                    planned.geometry.top) *
                    4) /
                    3 -
                  current;
                inserted += gap;
                result.push(
                  Decoration.widget(
                    pos,
                    () => {
                      const el = document.createElement("span");
                      el.className = "page-break";
                      el.contentEditable = "false";
                      el.dataset.page = String(number);
                      el.style.height = gap + "px";
                      el.style.setProperty("--break-at", breakAt + "px");
                      el.setAttribute("aria-label", `Página ${number}`);
                      return el;
                    },
                    { side: -1, key: `page-${number}-${gap}` },
                  ),
                );
              }
            }
            return DecorationSet.create(state.doc, result);
          },
        },
      });
      const view = new EditorView(host.current, {
        state: EditorState.create({
          schema,
          doc: schema.nodeFromJSON(props.doc),
          plugins: [...editorPlugins(), decorations, pagePlugin],
        }),
        attributes: {
          class: "screenplay",
          lang: "pt-BR",
          spellcheck: "true",
          "aria-label": "Editor de roteiro",
          role: "textbox",
          "aria-multiline": "true",
        },
        handleKeyDown(v, e) {
          if (e.isComposing || v.composing) return false;
          if (
            (e.ctrlKey || e.metaKey) &&
            ["b", "i", "u"].includes(e.key.toLowerCase())
          ) {
            e.preventDefault();
            toggleMark(
              schema.marks[
                { b: "bold", i: "italic", u: "underline" }[e.key.toLowerCase()]!
              ],
            )(v.state, v.dispatch);
            return true;
          }
          const s = suggestRef.current;
          if (s) {
            if (e.key === "Escape") {
              dismissed.current = true;
              setSuggestion(null);
              return true;
            }
            if (["ArrowDown", "ArrowUp"].includes(e.key)) {
              setSuggestion({
                ...s,
                active:
                  (s.active +
                    (e.key === "ArrowDown" ? 1 : -1) +
                    s.names.length) %
                  s.names.length,
              });
              return true;
            }
            if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
              accept(s.names[s.active]);
              return true;
            }
          }
          if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const current = v.state.selection.$from.parent.attrs.kind as Kind;
            const next =
              kinds[
                (kinds.indexOf(current) +
                  (e.shiftKey ? -1 : 1) +
                  kinds.length) %
                  kinds.length
              ];
            if (next === "shot" && callbacks.current.onShotRequest) {
              callbacks.current.onShotRequest();
              return true;
            }
          }
          if (e.key.length === 1 || e.key === "Backspace")
            dismissed.current = false;
          return false;
        },
        transformPastedHTML: (html) => html,
        clipboardTextParser(text, $context) {
          const kind = $context.parent.attrs.kind || "action";
          return schema
            .nodeFromJSON({
              type: "doc",
              content: text.split(/\r?\n/).map((line, i) => ({
                type: "block",
                attrs: { kind: i === 0 ? kind : "action" },
                ...(line ? { content: [{ type: "text", text: line }] } : {}),
              })),
            })
            .slice(0);
        },
        dispatchTransaction(tr) {
          const state = view.state.apply(tr);
          view.updateState(state);
          callbacks.current.onKind(state.selection.$from.parent.attrs.kind);
          callbacks.current.onHighlightChange?.(isHighlighted(state));
          if (tr.docChanged) {
            const doc = state.doc.toJSON() as ScriptDoc;
            callbacks.current.onChange(doc);
            callbacks.current.onPages(
              layout(doc.content, callbacks.current.paper).pages,
            );
          }
          const { $from } = state.selection;
          const prefix = $from.parent.textContent
            .trim()
            .toLocaleUpperCase("pt-BR");
          if (
            !dismissed.current &&
            $from.parent.attrs.kind === "character" &&
            prefix
          ) {
            const names = characters(state.doc.toJSON()).filter(
              (n) => n.startsWith(prefix) && n !== prefix,
            );
            if (names.length) {
              const rect = view.coordsAtPos(state.selection.from);
              setSuggestion({
                names,
                active: 0,
                x: rect.left,
                y: rect.bottom + 5,
              });
              return;
            }
          }
          setSuggestion(null);
        },
      });
      viewRef.current = view;
      callbacks.current.onPages(layout(props.doc.content, props.paper).pages);
      callbacks.current.onKind(view.state.selection.$from.parent.attrs.kind);
      callbacks.current.onHighlightChange?.(isHighlighted(view.state));
      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []);
    useEffect(() => {
      const v = viewRef.current;
      if (v) {
        v.setProps({});
        callbacks.current.onPages(
          layout(v.state.doc.toJSON().content, props.paper).pages,
        );
      }
    }, [props.paper]);
    useImperativeHandle(
      ref,
      () => ({
        focus() {
          viewRef.current?.focus();
        },
        command(name) {
          const v = viewRef.current;
          if (!v) return;
          if (name === "undo") undo(v.state, v.dispatch);
          else if (name === "redo") redo(v.state, v.dispatch);
          else if (schema.marks[name])
            toggleMark(schema.marks[name])(v.state, v.dispatch);
          v.focus();
        },
        kind(kind) {
          const v = viewRef.current;
          if (v) {
            setKind(kind)(v.state, v.dispatch);
            v.focus();
          }
        },
        shot(id) {
          const v = viewRef.current;
          if (v) {
            setShot(id)(v.state, v.dispatch);
            v.focus();
          }
        },
        currentShot() {
          const node = viewRef.current?.state.selection.$from.parent;
          if (node?.attrs.kind !== "shot") return null;
          const prefix = shotPrefix(node.textContent).toLocaleUpperCase(
            "pt-BR",
          );
          return (
            shots.find(
              (shot) =>
                prefix.startsWith(shot.name.toLocaleUpperCase("pt-BR")) ||
                (shot.id === "vo" && /^(?:VO|VOICE OVER)\b/.test(prefix)),
            )?.id || null
          );
        },
        scene(index) {
          const v = viewRef.current;
          if (!v) return;
          let count = 0;
          v.state.doc.forEach((n, pos) => {
            if (n.attrs.kind === "scene" && count++ === index) {
              v.dispatch(
                v.state.tr
                  .setSelection(TextSelection.create(v.state.doc, pos + 1))
                  .scrollIntoView(),
              );
              v.focus();
            }
          });
        },
        search(query) {
          queryRef.current = query;
          const v = viewRef.current;
          matches.current = [];
          matchIndex.current = -1;
          if (!v) return 0;
          if (query)
            v.state.doc.descendants((n, pos) => {
              if (n.isText) {
                let at = 0;
                while (
                  (at = n
                    .text!.toLocaleLowerCase()
                    .indexOf(query.toLocaleLowerCase(), at)) >= 0
                ) {
                  matches.current.push(pos + at);
                  at += query.length;
                }
              }
            });
          v.dispatch(v.state.tr.setMeta("search", true));
          return matches.current.length;
        },
        nextMatch() {
          const v = viewRef.current;
          if (!v || !matches.current.length) return;
          matchIndex.current =
            (matchIndex.current + 1) % matches.current.length;
          const pos = matches.current[matchIndex.current];
          v.dispatch(
            v.state.tr
              .setSelection(
                TextSelection.create(
                  v.state.doc,
                  pos,
                  pos + queryRef.current.length,
                ),
              )
              .scrollIntoView(),
          );
          v.focus();
        },
      }),
      [],
    );
    return (
      <>
        <div ref={host} />
        {suggestion && (
          <div
            className="suggestions"
            role="listbox"
            aria-label="Personagens"
            style={{
              left: Math.min(suggestion.x, window.innerWidth - 240),
              top: Math.min(suggestion.y, window.innerHeight - 200),
            }}
          >
            <small>PERSONAGENS DO ROTEIRO</small>
            {suggestion.names.map((name, i) => (
              <button
                key={name}
                role="option"
                aria-selected={i === suggestion.active}
                className={i === suggestion.active ? "selected" : ""}
                onMouseDown={(e) => {
                  e.preventDefault();
                  accept(name);
                }}
              >
                {name}
              </button>
            ))}
            <small>↑ ↓ escolher · Enter confirmar</small>
          </div>
        )}
        <span className="sr-only">
          {labels[props.doc.content[0]?.attrs.kind || "action"]}
        </span>
      </>
    );
  },
);
