import { describe, it, expect } from "vitest";
import { EditorState, TextSelection, type Command } from "prosemirror-state";
import { toggleMark } from "prosemirror-commands";
import { undo, redo } from "prosemirror-history";
import {
  schema,
  setKind,
  editorPlugins,
  enter,
  hardBreak,
  backspaceEmpty,
  cycleKind,
  setShot,
} from "../src/editor/schema";
import { sceneNumberDecorations } from "../src/editor/sceneNumbers";
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
  it("Insert adiciona o prefixo uma vez, posiciona o cursor e preserva o histórico", () => {
    const e = editor("action", "");
    e.run(setKind("insert"));
    expect(e.state.doc.textContent).toBe("INSERT ");
    expect(e.state.selection.from).toBe(8);
    e.run(undo);
    expect(e.state.doc.textContent).toBe("");
    expect(e.state.doc.child(0).attrs.kind).toBe("action");
    e.run(redo);
    e.run(setKind("insert"));
    expect(e.state.doc.textContent).toBe("INSERT ");
    const existing = editor("action", "insert: UM RELÓGIO");
    existing.run(setKind("insert"));
    expect(existing.state.doc.textContent).toBe("INSERT UM RELÓGIO");
  });
  it("Troca de enquadramento e Insert preserva descrição, marcas e quebras", () => {
    let state = EditorState.create({
      schema,
      doc: schema.nodes.doc.create(null, [
        schema.nodes.block.create({ kind: "action" }, [
          schema.text("Lia observa.", [
            schema.marks.highlight.create(),
            schema.marks.bold.create(),
          ]),
          schema.nodes.hard_break.create(),
          schema.text("Um detalhe."),
        ]),
      ]),
      plugins: editorPlugins(),
    });
    const run = (command: Command) =>
      command(state, (tr) => {
        state = state.apply(tr);
      });
    run(setShot("pm"));
    expect(state.doc.firstChild!.textContent).toBe(
      "PLANO MÉDIO — Lia observa.Um detalhe.",
    );
    run(setShot("pd"));
    expect(state.doc.firstChild!.textContent).toBe(
      "PLANO DETALHE — Lia observa.Um detalhe.",
    );
    run(setKind("insert"));
    expect(state.doc.firstChild!.textContent).toBe(
      "INSERT Lia observa.Um detalhe.",
    );
    run(setShot("pg"));
    const content = state.doc.firstChild!.toJSON().content;
    expect(content[0].text).toBe("PLANO GERAL — ");
    expect(content[1]).toEqual({
      type: "text",
      text: "Lia observa.",
      marks: [{ type: "bold" }, { type: "highlight" }],
    });
    expect(content[2].type).toBe("hard_break");
  });
  it("Numera cabeçalhos pela ordem, renumera mudanças e não modifica o texto salvo", () => {
    let state = EditorState.create({
      schema,
      doc: schema.nodeFromJSON({
        type: "doc",
        content: [
          block("scene", "INT. CASA - DIA"),
          block("action", "Uma ação."),
          block("scene", "EXT. RUA - DIA"),
        ],
      }),
      plugins: editorPlugins(),
    });
    const numbers = () =>
      sceneNumberDecorations(state.doc)
        .find()
        .filter((d) => d.spec.key)
        .map((d) => d.spec.key);
    expect(numbers()).toEqual(["scene-1", "scene-2"]);
    const original = state.doc.toJSON();
    state = state.apply(
      state.tr.setNodeMarkup(state.doc.child(0).nodeSize, undefined, {
        kind: "scene",
      }),
    );
    expect(numbers()).toEqual(["scene-1", "scene-2", "scene-3"]);
    undo(state, (tr) => {
      state = state.apply(tr);
    });
    expect(numbers()).toEqual(["scene-1", "scene-2"]);
    expect(state.doc.toJSON()).toEqual(original);
    state = state.apply(state.tr.delete(0, state.doc.child(0).nodeSize));
    expect(numbers()).toEqual(["scene-1"]);
    expect(
      sceneNumberDecorations(
        schema.nodeFromJSON({
          type: "doc",
          content: [block("scene", "Nova cena")],
        }),
      )
        .find()
        .filter((d) => d.spec.key)
        .map((d) => d.spec.key),
    ).toEqual(["scene-1"]);
  });
  it("Voice Over insere o prefixo e permite trocar de plano sem perder a narração", () => {
    const e = editor("action", "Uma lembrança distante.");
    e.run(setShot("vo"));
    expect(e.state.doc.textContent).toBe(
      "VOICE OVER (VO) — Uma lembrança distante.",
    );
    e.run(setShot("vo"));
    expect(e.state.doc.textContent).toBe(
      "VOICE OVER (VO) — Uma lembrança distante.",
    );
    e.run(setShot("pg"));
    expect(e.state.doc.textContent).toBe(
      "PLANO GERAL — Uma lembrança distante.",
    );
    e.run(setShot("vo"));
    e.run(setKind("insert"));
    expect(e.state.doc.textContent).toBe("INSERT Uma lembrança distante.");
  });
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
  it("Insere o par e posiciona o cursor dentro ao selecionar Parênteses", () => {
    const e = editor("action", "");
    e.run(setKind("parenthetical"));
    expect(e.state.doc.child(0).textContent).toBe("()");
    expect(e.state.selection.from).toBe(2);
    e.run((state, dispatch) => {
      dispatch?.(state.tr.insertText("sussurrando"));
      return true;
    });
    expect(e.state.doc.child(0).textContent).toBe("(sussurrando)");
  });
  it("Tab e Shift Tab também inserem o par automaticamente", () => {
    const forward = editor("dialogue", "");
    forward.run(cycleKind(1));
    expect(forward.state.doc.child(0).textContent).toBe("()");
    expect(forward.state.selection.from).toBe(2);
    const backward = editor("transition", "");
    backward.run(cycleKind(-1));
    expect(backward.state.doc.child(0).textContent).toBe("()");
    expect(backward.state.selection.from).toBe(2);
  });
  it.each(["calmamente", "(calmamente)", "(calmamente", "calmamente)"])(
    "Envolve texto sem duplicar parênteses: %s",
    (text) => {
      const e = editor("action", text);
      e.run(setKind("parenthetical"));
      e.run(setKind("parenthetical"));
      expect(e.state.doc.child(0).textContent).toBe("(calmamente)");
      expect(e.state.selection.$from.parentOffset).toBe("(calmamente".length);
    },
  );
  it("Preserva marcas e quebras ao envolver o conteúdo existente", () => {
    const content = [
      schema.text("com calma", [schema.marks.bold.create()]),
      schema.nodes.hard_break.create(),
      schema.text("sem pressa", [schema.marks.italic.create()]),
    ];
    let state = EditorState.create({
      schema,
      doc: schema.nodes.doc.create(null, [
        schema.nodes.block.create({ kind: "action" }, content),
      ]),
      plugins: editorPlugins(),
    });
    setKind("parenthetical")(state, (tr) => {
      state = state.apply(tr);
    });
    const paragraph = state.doc.child(0);
    expect(paragraph.textBetween(0, paragraph.content.size, "", "\n")).toBe(
      "(com calma\nsem pressa)",
    );
    const runs: { text: string; marks: string[] }[] = [];
    let breaks = 0;
    paragraph.forEach((node) => {
      if (node.isText)
        runs.push({
          text: node.text!,
          marks: node.marks.map((mark) => mark.type.name),
        });
      if (node.type.name === "hard_break") breaks++;
    });
    expect(runs.find((run) => run.text.includes("com calma"))?.marks).toEqual([
      "bold",
    ]);
    expect(runs.find((run) => run.text.includes("sem pressa"))?.marks).toEqual([
      "italic",
    ]);
    expect(breaks).toBe(1);
  });
  it("Mantém o cursor no meio do texto existente ao adicionar parênteses", () => {
    const e = editor("action", "com calma", 5);
    e.run(setKind("parenthetical"));
    expect(e.state.selection.from).toBe(6);
    e.run((state, dispatch) => {
      dispatch?.(state.tr.insertText("muita "));
      return true;
    });
    expect(e.state.doc.child(0).textContent).toBe("(com muita calma)");
  });
  it("Enter depois do texto interno mantém o fechamento e abre a fala", () => {
    const e = editor("action", "sussurrando");
    e.run(setKind("parenthetical"));
    e.run(enter);
    expect(e.state.doc.child(0).textContent).toBe("(sussurrando)");
    expect(e.state.doc.child(1).attrs.kind).toBe("dialogue");
    expect(e.state.selection.$from.parent.attrs.kind).toBe("dialogue");
    e.run((state, dispatch) => {
      dispatch?.(state.tr.insertText("Uma fala."));
      return true;
    });
    expect(e.state.doc.child(1).textContent).toBe("Uma fala.");
  });
  it("Backspace no par vazio retorna para ação sem deixar parênteses soltos", () => {
    const e = editor("action", "");
    e.run(setKind("parenthetical"));
    e.run(backspaceEmpty);
    expect(e.state.doc.childCount).toBe(1);
    expect(e.state.doc.child(0).attrs.kind).toBe("action");
    expect(e.state.doc.child(0).textContent).toBe("");
  });
  it("Trocar o tipo de um par vazio limpa somente o par", () => {
    const e = editor("action", "");
    e.run(setKind("parenthetical"));
    e.run(setKind("character"));
    expect(e.state.doc.child(0).textContent).toBe("");
    expect(e.state.doc.child(0).attrs.kind).toBe("character");
    const filled = editor("action", "com calma");
    filled.run(setKind("parenthetical"));
    filled.run(setKind("action"));
    expect(filled.state.doc.child(0).textContent).toBe("(com calma)");
  });
  it("Desfaz e refaz a mudança de tipo e o par em uma operação", () => {
    const e = editor("action", "com calma");
    e.run(setKind("parenthetical"));
    e.run(undo);
    expect(e.state.doc.child(0).attrs.kind).toBe("action");
    expect(e.state.doc.child(0).textContent).toBe("com calma");
    e.run(redo);
    expect(e.state.doc.child(0).attrs.kind).toBe("parenthetical");
    expect(e.state.doc.child(0).textContent).toBe("(com calma)");
  });
  it("Grifa somente a seleção, combina com negrito e permite desfazer e remover", () => {
    const e = editor("action", "Texto importante aqui");
    e.run((state, dispatch) => {
      dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, 7, 17)));
      return true;
    });
    e.run(toggleMark(schema.marks.bold));
    e.run(toggleMark(schema.marks.highlight));
    expect(e.state.doc.textContent).toBe("Texto importante aqui");
    expect(e.state.doc.child(0).child(0).marks).toHaveLength(0);
    expect(e.state.doc.child(0).child(1).text).toBe("importante");
    expect(
      e.state.doc
        .child(0)
        .child(1)
        .marks.map((m) => m.type.name),
    ).toEqual(["bold", "highlight"]);
    e.run(undo);
    expect(e.state.doc.rangeHasMark(7, 17, schema.marks.highlight)).toBe(false);
    e.run(redo);
    expect(e.state.doc.rangeHasMark(7, 17, schema.marks.highlight)).toBe(true);
    e.run(toggleMark(schema.marks.highlight));
    expect(e.state.doc.rangeHasMark(7, 17, schema.marks.highlight)).toBe(false);
    expect(e.state.doc.rangeHasMark(7, 17, schema.marks.bold)).toBe(true);
  });
  it("O marca-texto também pode ser ativado para o texto que será digitado", () => {
    const e = editor("action", "");
    e.run(toggleMark(schema.marks.highlight));
    e.run((state, dispatch) => {
      dispatch?.(state.tr.insertText("Ideia destacada"));
      return true;
    });
    expect(
      e.state.doc
        .child(0)
        .child(0)
        .marks.map((m) => m.type.name),
    ).toEqual(["highlight"]);
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
