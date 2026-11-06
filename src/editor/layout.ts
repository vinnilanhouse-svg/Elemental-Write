import {
  textOf,
  uppercase,
  type Block,
  type Manuscript,
  type Kind,
} from "../model";
export const characterWidth = 7.224609375;
export const geometry = (paper: Manuscript["paper"]) => ({
  width: paper === "a4" ? 595.28 : 612,
  height: paper === "a4" ? 841.89 : 792,
  left: 108,
  right: 72,
  top: 72,
  bottom: 72,
  line: 14.4,
  font: 12,
});
export const indents: Record<
  Kind,
  { left: number; right: number; after: number; align: "left" | "right" }
> = {
  scene: { left: 0, right: 0, after: 14.4, align: "left" },
  action: { left: 0, right: 0, after: 14.4, align: "left" },
  character: { left: 144, right: 0, after: 0, align: "left" },
  dialogue: { left: 72, right: 72, after: 14.4, align: "left" },
  parenthetical: { left: 108, right: 108, after: 0, align: "left" },
  transition: { left: 0, right: 0, after: 14.4, align: "right" },
};
export type LayoutLine = {
  text: string;
  start: number;
  end: number;
  blockIndex: number;
  kind: Kind;
  x: number;
  y: number;
  page: number;
};
export function wrap(
  text: string,
  max: number,
): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  let offset = 0;
  for (const raw of text.split("\n")) {
    let s = raw;
    let consumed = 0;
    if (!s) out.push({ text: "", start: offset, end: offset });
    while (s.length) {
      let n = Math.min(max, s.length);
      if (n < s.length) {
        const space = s.lastIndexOf(" ", n);
        if (space > 0) n = space + 1;
      }
      out.push({
        text: s.slice(0, n),
        start: offset + consumed,
        end: offset + consumed + n,
      });
      s = s.slice(n);
      consumed += n;
    }
    offset += raw.length + 1;
  }
  return out;
}
export function layout(blocks: Block[], paper: Manuscript["paper"]) {
  const g = geometry(paper);
  const lines: LayoutLine[] = [];
  let y = g.top,
    page = 1;
  blocks.forEach((b, blockIndex) => {
    const kind = b.attrs.kind;
    const style = indents[kind];
    const width = g.width - g.left - g.right - style.left - style.right;
    const text = textOf(b);
    const rows = wrap(text, Math.max(8, Math.floor(width / characterWidth)));
    const bottom = g.height - g.bottom;
    let reserve = g.line;
    if (kind === "scene") reserve = rows.length * g.line + style.after + g.line;
    if (kind === "character" || kind === "parenthetical") {
      reserve = rows.length * g.line;
      let next = blockIndex + 1;
      while (blocks[next]?.attrs.kind === "parenthetical") {
        const v = blocks[next];
        const indent = indents.parenthetical;
        reserve +=
          wrap(
            textOf(v),
            Math.floor(
              (g.width - g.left - g.right - indent.left - indent.right) /
                characterWidth,
            ),
          ).length * g.line;
        next++;
      }
      if (blocks[next]?.attrs.kind === "dialogue") reserve += g.line;
    }
    reserve = Math.min(reserve, bottom - g.top);
    if (y + reserve > bottom) {
      page++;
      y = g.top;
    }
    rows.forEach((row) => {
      if (y + g.line > bottom) {
        page++;
        y = g.top;
      }
      const t = uppercase(kind)
        ? row.text.toLocaleUpperCase("pt-BR")
        : row.text;
      lines.push({
        ...row,
        text: t,
        blockIndex,
        kind,
        x:
          style.align === "right"
            ? g.width - g.right - t.length * characterWidth
            : g.left + style.left,
        y,
        page,
      });
      y += g.line;
    });
    y += style.after;
  });
  return { lines, pages: Math.max(1, page), geometry: g };
}
