import { describe, it, expect } from "vitest";
import { EditorState, TextSelection, type Command } from "prosemirror-state";
import { undo } from "prosemirror-history";
import {
  schema,
  editorPlugins,
  enter,
  hardBreak,
  backspaceEmpty,
  cycleKind,
} from "../src/editor/schema";
import {
  block,
  kinds,
  nextKind,
  characters,
  textOf,
  type Kind,
} from "../src/model";
import { layout } from "../src/editor/layout";
function editor(kind: Kind, text: string, pos?: number) {
  let state = EditorState.create({
    schema,
    doc: schema.nodeFromJSON({ type: "doc", content: [block(kind, text)] }),
    plugins: editorPlugins(),
  });
  state = state.apply(
    state.tr.setSelection(
      TextSelection.create(state.doc, pos ?? text.length + 1),
    ),
  );
  return {
    get state() {
      return state;
    },
    run(cmd: Command) {
      cmd(state, (tr) => (state = state.apply(tr)));
    },
  };
}
describe("Regras reais do editor ProseMirror", () => {
  for (const kind of kinds)
    it(`Enter: ${kind} → ${nextKind[kind]}`, () => {
      const e = editor(kind, "Algumas palavras");
      e.run(enter);
      expect(e.state.doc.child(1).attrs.kind).toBe(nextKind[kind]);
      expect(e.state.doc.child(0).textContent).toBe("Algumas palavras");
    });
  it("Divide no meio preservando texto e desfaz em uma operação", () => {
    const e = editor("dialogue", "Todas as palavras ficam", 10);
    e.run(enter);
    expect(e.state.doc.childCount).toBe(2);
    expect(e.state.doc.textContent).toBe("Todas as palavras ficam");
    expect(e.state.doc.child(1).attrs.kind).toBe("character");
    e.run(undo);
    expect(e.state.doc.childCount).toBe(1);
    expect(e.state.doc.textContent).toBe("Todas as palavras ficam");
  });
  it("Personagem vazio vira ação sem adicionar blocos", () => {
    const e = editor("character", "");
    e.run(enter);
    expect(e.state.doc.childCount).toBe(1);
    expect(e.state.doc.child(0).attrs.kind).toBe("action");
  });
  it("Backspace vazio retorna para ação", () => {
    const e = editor("dialogue", "");
    e.run(backspaceEmpty);
    expect(e.state.doc.child(0).attrs.kind).toBe("action");
  });
  it("Shift Enter preserva bloco e histórico", () => {
    const e = editor("dialogue", "Olá");
    e.run(hardBreak);
    expect(e.state.doc.childCount).toBe(1);
    expect(e.state.doc.child(0).lastChild?.type.name).toBe("hard_break");
    e.run(undo);
    expect(e.state.doc.child(0).childCount).toBe(1);
  });
  it("Tab e Shift Tab percorrem tipos", () => {
    const e = editor("action", "");
    e.run(cycleKind(1));
    expect(e.state.doc.child(0).attrs.kind).toBe("character");
    e.run(cycleKind(-1));
    expect(e.state.doc.child(0).attrs.kind).toBe("action");
  });
  for (const prefix of ["INT.", "EXT.", "INT./EXT."])
    it("Reconhece " + prefix, () => {
      const e = editor("action", "");
      e.run((state, dispatch) => {
        dispatch?.(state.tr.insertText(prefix + " CASA"));
        return true;
      });
      expect(e.state.doc.child(0).attrs.kind).toBe("scene");
    });
  it("Mantém caixa de ação e fala; nomes derivados sem duplicação", () => {
    const e = editor("action", "Uma frase natural");
    expect(e.state.doc.textContent).toBe("Uma frase natural");
    expect(
      characters({
        type: "doc",
        content: [
          block("action", "NÃO É NOME"),
          block("character", "Lia"),
          block("character", "LIA"),
        ],
      }),
    ).toEqual(["LIA"]);
  });
  it("Paginação longa preserva texto, subdivide blocos e mantém personagem com fala", () => {
    const blocks = [
      ...Array.from({ length: 45 }, () => block("action", "Uma ação breve.")),
      block("character", "LIA"),
      block("parenthetical", "(calmamente)"),
      block("dialogue", "Todas as palavras continuam. ".repeat(400)),
    ];
    for (const paper of ["letter", "a4"] as const) {
      const p = layout(blocks, paper);
      expect(p.pages).toBeGreaterThan(3);
      const character = p.lines.find((l) => l.kind === "character")!;
      expect(p.lines.find((l) => l.kind === "dialogue")!.page).toBe(
        character.page,
      );
      for (let i = 0; i < blocks.length; i++)
        expect(
          p.lines
            .filter((l) => l.blockIndex === i)
            .map((l) => l.text)
            .join(""),
        ).toBe(textOf(blocks[i]));
      for (const l of p.lines) {
        expect(l.y).toBeGreaterThanOrEqual(p.geometry.top);
        expect(l.y + p.geometry.line).toBeLessThanOrEqual(
          p.geometry.height - p.geometry.bottom + 0.01,
        );
      }
    }
  });
});
