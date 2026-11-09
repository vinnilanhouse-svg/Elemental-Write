import { id } from "../model";
import { wrap, characterWidth } from "../editor/layout";
export type CoverBlock = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  align: "left" | "center" | "right";
  bold: boolean;
  italic: boolean;
};
export type CoverTemplate = { version: 1; blocks: CoverBlock[] };
export type CoverContext = { projeto: string; roteiro: string; autor: string };
export const defaultCover = (): CoverTemplate => ({
  version: 1,
  blocks: [
    {
      id: id(),
      text: "{projeto}\n{roteiro}\n\n\nEscrito por\n{autor}",
      x: 16,
      y: 34,
      width: 68,
      fontSize: 12,
      align: "center",
      bold: false,
      italic: false,
    },
    {
      id: id(),
      text: "",
      x: 12,
      y: 84,
      width: 76,
      fontSize: 12,
      align: "left",
      bold: false,
      italic: false,
    },
  ],
});
export const resolveCoverText = (text: string, context: CoverContext) =>
  text.replace(
    /\{(projeto|roteiro|autor)\}/g,
    (_, key: keyof CoverContext) => context[key],
  );
export function layoutCover(
  template: CoverTemplate,
  context: CoverContext,
  width: number,
  height: number,
) {
  return template.blocks.map((block) => {
    const text = resolveCoverText(block.text, context);
    const lineHeight = block.fontSize * 1.2;
    const rows = text
      ? wrap(
          text,
          Math.max(
            1,
            Math.floor(
              ((block.width / 100) * width) /
                ((characterWidth / 12) * block.fontSize),
            ),
          ),
        )
      : [];
    const left = (block.x / 100) * width,
      top = (block.y / 100) * height;
    const blockWidth = (block.width / 100) * width;
    const x =
      left +
      (block.align === "center"
        ? blockWidth / 2
        : block.align === "right"
          ? blockWidth
          : 0);
    return {
      ...block,
      left,
      top,
      blockWidth,
      lineHeight,
      lines: rows.map((row, i) => ({
        text: row.text.trimEnd(),
        x,
        y: top + block.fontSize + i * lineHeight,
      })),
      overflow:
        !!rows.length &&
        (left < 0 ||
          left + blockWidth > width + 0.01 ||
          top < 0 ||
          rows.some(
            (row) =>
              row.text.trimEnd().length *
                (characterWidth / 12) *
                block.fontSize >
              blockWidth + 0.01,
          ) ||
          top + block.fontSize + (rows.length - 1) * lineHeight > height - 12),
    };
  });
}
export function validateCover(value: unknown): value is CoverTemplate {
  if (!value || typeof value !== "object") return false;
  const c = value as CoverTemplate;
  return (
    c.version === 1 &&
    Array.isArray(c.blocks) &&
    new Set(c.blocks.map((b) => b?.id)).size === c.blocks.length &&
    c.blocks.every(
      (b) =>
        !!b &&
        typeof b.id === "string" &&
        !!b.id &&
        typeof b.text === "string" &&
        [b.x, b.y, b.width, b.fontSize].every(Number.isFinite) &&
        b.x >= 0 &&
        b.y >= 0 &&
        b.y <= 98 &&
        b.width >= 5 &&
        b.x + b.width <= 100.01 &&
        b.fontSize >= 8 &&
        b.fontSize <= 72 &&
        ["left", "center", "right"].includes(b.align) &&
        typeof b.bold === "boolean" &&
        typeof b.italic === "boolean",
    )
  );
}
