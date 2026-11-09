import { describe, it, expect } from "vitest";
import {
  defaultCover,
  resolveCoverText,
  layoutCover,
  validateCover,
} from "../src/cover/model";
describe("Capa automática do projeto", () => {
  const context = {
    projeto: "Institucionais",
    roteiro: "LED Max (Tutorial)",
    autor: "Ana Ribeiro",
  };
  it("Resolve nomes dinamicamente e mantém os textos livres", () => {
    expect(
      resolveCoverText(
        "{projeto}\n{roteiro}\nPor {autor}\ncontato@example.com",
        context,
      ),
    ).toBe(
      "Institucionais\nLED Max (Tutorial)\nPor Ana Ribeiro\ncontato@example.com",
    );
    expect(
      resolveCoverText("{roteiro}", { ...context, roteiro: "Novo roteiro" }),
    ).toBe("Novo roteiro");
  });
  it("Modelo centralizado cabe em Carta e A4 com autoria e contato livre", () => {
    const cover = defaultCover();
    expect(validateCover(cover)).toBe(true);
    for (const [w, h] of [
      [612, 792],
      [595.28, 841.89],
    ]) {
      const plan = layoutCover(cover, context, w, h);
      expect(plan.some((b) => b.overflow)).toBe(false);
      expect(plan[0].lines.map((l) => l.text)).toEqual([
        "Institucionais",
        "LED Max (Tutorial)",
        "",
        "",
        "Escrito por",
        "Ana Ribeiro",
      ]);
      expect(plan[0].lines.every((l) => Math.abs(l.x - w / 2) < 0.01)).toBe(
        true,
      );
      expect(plan[1].lines).toEqual([]);
    }
  });
  it("Respeita posição, alinhamento, fonte e quebras, e sinaliza texto além da página", () => {
    const cover = defaultCover();
    cover.blocks = [
      {
        ...cover.blocks[0],
        text: "Um texto muito longo ".repeat(30),
        x: 10,
        width: 80,
        y: 90,
        align: "right",
        fontSize: 24,
        bold: true,
      },
    ];
    const [block] = layoutCover(cover, context, 612, 792);
    expect(block.lines.length).toBeGreaterThan(10);
    expect(block.lines[0].x).toBeCloseTo(612 * 0.9);
    expect(block.bold).toBe(true);
    expect(block.overflow).toBe(true);
  });
  it("Rejeita coordenadas e estilos inválidos, valores não finitos e identidades repetidas", () => {
    const cover = defaultCover();
    expect(validateCover({ ...cover, blocks: [null] })).toBe(false);
    expect(
      validateCover({ ...cover, blocks: [cover.blocks[0], cover.blocks[0]] }),
    ).toBe(false);
    for (const patch of [
      { x: -1 },
      { y: Infinity },
      { width: 101 },
      { fontSize: 0 },
      { align: "invalid" },
    ])
      expect(
        validateCover({ ...cover, blocks: [{ ...cover.blocks[0], ...patch }] }),
      ).toBe(false);
  });
});
