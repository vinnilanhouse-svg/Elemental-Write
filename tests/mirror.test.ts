import { describe, it, expect } from "vitest";
import { block, makeManuscript, type ScriptDoc } from "../src/model";
import {
  blankCells,
  createMirror,
  generateRows,
  updateMirror,
  replaceMirrorRows,
  estimatedTime,
  validateMirror,
} from "../src/mirror/model";
import { mirrorCSV } from "../src/mirror/export";
import { backup, parseBackup } from "../src/io/backup";

function example() {
  const d = makeManuscript("p", "Duas cenas");
  d.author = "Ana";
  d.doc = {
    type: "doc",
    content: [
      block("scene", "INT. CASA — DIA"),
      block("action", "Lia abre a porta."),
      block("shot", "PLANO MÉDIO — DUAS PESSOAS."),
      block("character", "LIA"),
      block("parenthetical", "(olhando os lados)"),
      block("dialogue", "Você voltou."),
      block("action", "Tomás se aproxima."),
      block("insert", 'INSERT LETTERING: "TRÊS ANOS DEPOIS"'),
      block("character", "TOMÁS (V.O.)"),
      {
        type: "block",
        attrs: { kind: "dialogue" },
        content: [
          { type: "text", text: "Nunca fui embora." },
          { type: "hard_break" },
          { type: "text", text: "Eu te esperei." },
        ],
      },
      block("character", "LIA"),
      block("dialogue", "Eu sei."),
      block("action", "A porta se fecha."),
      block("scene", "EXT. PRAIA — NOITE"),
      block("insert", "INSERT UMA CONCHA."),
      block("shot", "VOICE OVER (VO) — O mar guardava a história."),
      block("transition", "FADE OUT."),
    ],
  };
  return d;
}
describe("Espelho de cinco colunas", () => {
  it("Repete a cena em cada fala, reconhece personagem, parênteses, VO e lettering explícito", () => {
    const rows = generateRows(example().doc);
    expect(rows.map((r) => r.scene)).toEqual(["1", "1", "1", "2"]);
    expect(rows.map((r) => r.spoken)).toEqual([
      "Você voltou.",
      "Nunca fui embora.\nEu te esperei.",
      "Eu sei.",
      "O mar guardava a história.",
    ]);
    expect(rows[0].delivery).toBe("LIA · Vivo\n(olhando os lados)");
    expect(rows[1].delivery).toBe("TOMÁS · Off (VO)");
    expect(rows[3].delivery).toBe("Off (VO)");
    expect(rows[0].description).toContain("Lia abre a porta.");
    expect(rows[0].description).toContain("PLANO MÉDIO");
    expect(rows[1].description).toContain("Tomás se aproxima.");
    expect(rows[1].lettering).toBe("TRÊS ANOS DEPOIS");
    expect(rows[2].description).toContain("A porta se fecha.");
    expect(rows[3].description).toContain("FADE OUT.");
    expect(rows[3].description).toContain("INSERT UMA CONCHA.");
    expect(rows[3].lettering).toBe("");
  });
  it("Conserva cenas sem falas e trechos sem cabeçalho, sem inventar texto falado", () => {
    const doc: ScriptDoc = {
      type: "doc",
      content: [
        block("action", "Uma abertura."),
        block("scene", "EXT. RUA — DIA"),
        block("action", "Um carro passa."),
        block("scene", "INT. CASA — DIA"),
      ],
    };
    const rows = generateRows(doc);
    expect(rows.map((r) => r.scene)).toEqual(["—", "1", "2"]);
    expect(rows.every((r) => r.spoken === "")).toBe(true);
    expect(rows[0].description).toBe("Uma abertura.");
    expect(rows[1].description).toContain("Um carro passa.");
    expect(createMirror({ ...example(), doc }).fields.estimatedTime).toBe("");
  });
  it("Campos automáticos usam autor e duração da fala; duração manual é preservada", () => {
    const d = example();
    d.author = "";
    let mirror = createMirror(d, "Bruno");
    expect(mirror.fields.writer).toBe("Bruno");
    expect(mirror.fields.reviewedBy).toBe("");
    expect(mirror.fields.approvedBy).toBe("");
    expect(
      estimatedTime([{ ...blankCells(), spoken: "palavra ".repeat(150) }]),
    ).toBe("1 min");
    mirror = replaceMirrorRows(mirror, [
      { ...mirror.rows[0], spoken: "palavra ".repeat(300) },
    ]);
    expect(mirror.fields.estimatedTime).toBe("2 min");
    mirror.fields.estimatedTime = "3 min com pausas";
    expect(replaceMirrorRows(mirror, []).fields.estimatedTime).toBe(
      "3 min com pausas",
    );
  });
  it("Atualiza ações e numeração preservando as células ajustadas e exclusões", () => {
    const d = example();
    const old = createMirror(d);
    old.rows[0].lettering = "AJUSTE MANUAL";
    old.fields.productionNotes = "Levar a carta.";
    old.deletedSourceKeys.push(old.rows[2].sourceKey!);
    old.rows.splice(2, 1);
    d.doc.content[1] = block("action", "Lia abre a porta devagar.");
    d.doc.content.unshift(
      block("scene", "EXT. FAROL — DIA"),
      block("action", "O farol acende."),
    );
    const updated = updateMirror(old, d);
    expect(updated.rows.map((r) => r.scene)).toEqual(["1", "2", "2", "3"]);
    expect(updated.rows[1].lettering).toBe("AJUSTE MANUAL");
    expect(updated.rows[1].description).toContain("devagar");
    expect(updated.rows[1].id).toBe(old.rows[0].id);
    expect(updated.fields.productionNotes).toBe("Levar a carta.");
    expect(updated.rows.some((r) => r.spoken === "Eu sei.")).toBe(false);
    expect(old.rows[0].description).not.toContain("devagar");
  });
  it("Fala alterada mantém ajustes sem correspondência como linha para revisão, sem duplicá-la na atualização seguinte", () => {
    const d = example();
    const old = createMirror(d);
    old.rows[0].lettering = "IMPORTANTE";
    d.doc.content[5] = block("dialogue", "Você voltou hoje.");
    const updated = updateMirror(old, d);
    expect(updated.rows).toHaveLength(5);
    expect(updated.rows[0].spoken).toBe("Você voltou hoje.");
    expect(updated.rows[4].spoken).toBe("Você voltou.");
    expect(updated.rows[4].review).toBe(true);
    expect(updated.rows[4].lettering).toBe("IMPORTANTE");
    const twice = updateMirror(updated, d);
    expect(twice.rows).toHaveLength(5);
    expect(twice.rows.filter((r) => r.review)).toHaveLength(1);
  });
  it("Linhas manuais e falas iguais recebem identidades distintas", () => {
    const d = example();
    d.doc.content = [
      block("scene", "INT. CASA — DIA"),
      block("character", "LIA"),
      block("dialogue", "Sim."),
      block("dialogue", "Sim."),
    ];
    const old = createMirror(d);
    expect(old.rows[0].sourceKey).not.toBe(old.rows[1].sourceKey);
    old.rows.push({ ...blankCells("1"), id: "manual", spoken: "Outra fala." });
    const updated = updateMirror(old, d);
    expect(updated.rows.at(-1)?.spoken).toBe("Outra fala.");
    expect(JSON.parse(JSON.stringify(updated))).toEqual(updated);
  });
  it("Backup antigo continua válido e espelho inválido é rejeitado antes da restauração", () => {
    const d = example();
    const project = {
      id: "p",
      profileId: "a",
      title: "Teste",
      description: "",
      createdAt: 0,
      updatedAt: 0,
    };
    expect(
      parseBackup(JSON.stringify(backup(project, [d]))).documents[0].mirror,
    ).toBeUndefined();
    d.mirror = createMirror(d);
    expect(
      parseBackup(JSON.stringify(backup(project, [d]))).documents[0].mirror,
    ).toEqual(d.mirror);
    expect(validateMirror({ ...d.mirror, rows: [null] })).toBe(false);
    expect(
      validateMirror({
        ...d.mirror,
        rows: [d.mirror.rows[0], d.mirror.rows[0]],
      }),
    ).toBe(false);
    const invalid = { ...d.mirror, fields: { ...d.mirror.fields, writer: 42 } };
    expect(() =>
      parseBackup(
        JSON.stringify(
          backup(project, [{ ...d, mirror: invalid } as unknown as typeof d]),
        ),
      ),
    ).toThrow("documentos inválidos");
  });
  it("CSV mantém cinco colunas, acentos, aspas, quebras e uma linha por fala", () => {
    const mirror = createMirror(example());
    mirror.rows[0].lettering = 'Linha "um"; teste\nLinha dois';
    const csv = mirrorCSV(mirror);
    expect(
      csv.startsWith(
        '\uFEFF"Cena";"Texto falado";"Indicação da fala";"Lettering";"Descrição de cena"',
      ),
    ).toBe(true);
    expect(csv).toContain('"Linha ""um""; teste\nLinha dois"');
    expect(csv).toContain('"1";"Você voltou."');
  });
});
