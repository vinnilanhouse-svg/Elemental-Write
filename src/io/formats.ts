import {
  block,
  textOf,
  uppercase,
  type Manuscript,
  type ScriptDoc,
  type Block,
  type Kind,
  type Span,
  type Mark,
} from "../model";
import { geometry, indents, layout } from "../editor/layout";
export const styleNames: Record<Kind, string> = {
  scene: "Scene Heading",
  action: "Action",
  character: "Character",
  dialogue: "Dialogue",
  parenthetical: "Parenthetical",
  transition: "Transition",
};
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const rich = (b: Block) =>
  b.content
    ?.map((s) => {
      if (s.type === "hard_break") return "\n";
      let t = s.text.replace(/([\\*_])/g, "\\$1");
      if (s.marks?.some((m) => m.type === "underline")) t = "_" + t + "_";
      if (s.marks?.some((m) => m.type === "italic")) t = "*" + t + "*";
      if (s.marks?.some((m) => m.type === "bold")) t = "**" + t + "**";
      return t;
    })
    .join("") || "";
export function fountainExport(d: Manuscript) {
  let output = `Title: ${d.title.replace(/\n/g, " ")}\nAuthor: ${d.author.replace(/\n/g, " ")}\n\n`;
  d.doc.content.forEach((b, i) => {
    const previous = d.doc.content[i - 1]?.attrs.kind;
    const k = b.attrs.kind;
    const connected =
      (previous === "character" || previous === "parenthetical") &&
      (k === "dialogue" || k === "parenthetical");
    if (i) output += connected ? "\n" : "\n\n";
    const t = rich(b);
    output +=
      k === "scene"
        ? "." + t.toLocaleUpperCase("pt-BR")
        : k === "action"
          ? "!" + t
          : k === "character"
            ? "@" + t.toLocaleUpperCase("pt-BR")
            : k === "transition"
              ? ">" + t.toLocaleUpperCase("pt-BR")
              : k === "parenthetical" && !textOf(b).trimStart().startsWith("(")
                ? "(" + t + ")"
                : t;
  });
  return output;
}
export function parseInline(text: string): Span[] {
  const result: Span[] = [];
  const re = /(\\[\\*_]|\*\*|\*|_|\n)/g;
  const marks = new Set<Mark["type"]>();
  let last = 0;
  const add = (s: string) => {
    if (s)
      result.push({
        type: "text",
        text: s,
        ...(marks.size ? { marks: [...marks].map((type) => ({ type })) } : {}),
      });
  };
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    add(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("\\")) add(token.slice(1));
    else if (token === "\n") result.push({ type: "hard_break" });
    else {
      const type =
        token === "**" ? "bold" : token === "*" ? "italic" : "underline";
      if (marks.has(type)) marks.delete(type);
      else if (text.slice(re.lastIndex).includes(token)) marks.add(type);
      else add(token);
    }
    last = re.lastIndex;
  }
  add(text.slice(last));
  return result;
}
export function parseFountain(raw: string): {
  doc: ScriptDoc;
  title: string;
  author: string;
} {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .split("\n");
  let title = "",
    author = "";
  while (
    lines.length &&
    /^(Title|Author|Credit|Source|Draft date|Contact|Copyright|Notes):/i.test(
      lines[0],
    )
  ) {
    const line = lines.shift()!;
    if (/^Title:/i.test(line)) title = line.replace(/^Title:\s*/i, "");
    if (/^Author:/i.test(line)) author = line.replace(/^Author:\s*/i, "");
  }
  const blocks: Block[] = [];
  const push = (kind: Kind, t: string) => {
    const content = parseInline(t);
    blocks.push({
      type: "block",
      attrs: { kind },
      ...(content.length ? { content } : {}),
    });
  };
  const isParenthetical = (value: string) => {
    const plain = parseInline(value)
      .map((span) => (span.type === "text" ? span.text : "\n"))
      .join("")
      .trim();
    return /^\([\s\S]*\)$/.test(plain);
  };
  for (const rawParagraph of lines.join("\n").split(/\n[ \t]*\n/)) {
    const paragraph = rawParagraph.replace(/^\n+|\n+$/g, "");
    if (!paragraph.trim()) continue;
    const rows = paragraph.replace(/^\n+|\n+$/g, "").split("\n");
    let first = rows[0];
    if (first.startsWith("!")) {
      push("action", [first.slice(1), ...rows.slice(1)].join("\n"));
      continue;
    }
    if (
      /^\.(?!\.)/.test(first) ||
      /^(INT\.|EXT\.|INT\.\/EXT\.)\s/i.test(first)
    ) {
      push("scene", paragraph.replace(/^\./, ""));
      continue;
    }
    if (first.startsWith(">") || /TO:$/.test(first)) {
      push("transition", paragraph.replace(/^>/, ""));
      continue;
    }
    if (isParenthetical(first)) {
      if (rows.every(isParenthetical))
        rows.forEach((row) => push("parenthetical", row));
      else push("parenthetical", paragraph);
      continue;
    }
    const cue =
      first.startsWith("@") ||
      (rows.length > 1 &&
        first === first.toLocaleUpperCase("pt-BR") &&
        /[A-ZÀ-Ü]/.test(first) &&
        first.length < 60);
    if (cue) {
      push("character", first.replace(/^@/, ""));
      let speech: string[] = [];
      const flush = () => {
        if (speech.length) {
          push("dialogue", speech.join("\n"));
          speech = [];
        }
      };
      for (const row of rows.slice(1)) {
        if (isParenthetical(row)) {
          flush();
          push("parenthetical", row);
        } else speech.push(row);
      }
      flush();
      continue;
    }
    push("action", paragraph);
  }
  return {
    doc: { type: "doc", content: blocks.length ? blocks : [block()] },
    title,
    author,
  };
}
export function fdxExport(d: Manuscript) {
  return `<?xml version="1.0" encoding="UTF-8"?><FinalDraft DocumentType="Script" Template="No" Version="1"><Content>${d.doc.content.map((b) => `<Paragraph Type="${styleNames[b.attrs.kind]}">${b.content?.map((s) => (s.type === "hard_break" ? "<Text>\n</Text>" : `<Text${s.marks?.length ? ` Style="${s.marks.map((m) => ({ bold: "Bold", italic: "Italic", underline: "Underline" })[m.type]).join("+")}"` : ""}>${esc(uppercase(b.attrs.kind) ? s.text.toLocaleUpperCase("pt-BR") : s.text)}</Text>`)).join("") || "<Text></Text>"}</Paragraph>`).join("")}</Content><TitlePage><Content><Paragraph Type="Title"><Text>${esc(d.title)}</Text></Paragraph><Paragraph Type="Author"><Text>${esc(d.author)}</Text></Paragraph></Content></TitlePage></FinalDraft>`;
}
export function parseXml(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw Error("Arquivos com entidades XML externas não são aceitos.");
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  if (parsed.querySelector("parsererror"))
    throw Error("O arquivo XML está incompleto ou inválido.");
  return parsed;
}
export function parseFDX(raw: string) {
  const xml = parseXml(raw);
  if (xml.documentElement.nodeName !== "FinalDraft")
    throw Error("Este arquivo não é um FDX válido.");
  const paragraphs = [
    ...xml.querySelectorAll("FinalDraft > Content > Paragraph"),
  ];
  const content = paragraphs.map((p) => {
    const kind =
      (Object.keys(styleNames) as Kind[]).find(
        (k) => styleNames[k] === p.getAttribute("Type"),
      ) || "action";
    const spans: Span[] = [];
    p.querySelectorAll("Text").forEach((t) => {
      const marks: Mark[] = [];
      const style = t.getAttribute("Style") || "";
      if (style.includes("Bold")) marks.push({ type: "bold" });
      if (style.includes("Italic")) marks.push({ type: "italic" });
      if (style.includes("Underline")) marks.push({ type: "underline" });
      (t.textContent || "").split("\n").forEach((text, i) => {
        if (i) spans.push({ type: "hard_break" });
        if (text)
          spans.push({
            type: "text",
            text,
            ...(marks.length ? { marks } : {}),
          });
      });
    });
    return {
      type: "block" as const,
      attrs: { kind },
      ...(spans.length ? { content: spans } : {}),
    };
  });
  if (!content.length) throw Error("O FDX não contém parágrafos de roteiro.");
  return {
    doc: { type: "doc" as const, content },
    title:
      xml.querySelector('TitlePage Paragraph[Type="Title"]')?.textContent || "",
    author:
      xml.querySelector('TitlePage Paragraph[Type="Author"]')?.textContent ||
      "",
  };
}
export async function docxExport(d: Manuscript) {
  const {
    Document: DocxDocument,
    Packer,
    Paragraph,
    TextRun,
    Header,
    Footer,
    PageNumber,
    AlignmentType,
    UnderlineType,
  } = await import("docx");
  const g = geometry(d.paper);
  const styles = (Object.keys(styleNames) as Kind[]).map((k) => ({
    id: k,
    name: styleNames[k],
    basedOn: "Normal",
    run: { font: "DejaVu Sans Mono", size: 24 },
    paragraph: {
      spacing: { after: Math.round(indents[k].after * 20), line: 288 },
      indent: { left: indents[k].left * 20, right: indents[k].right * 20 },
      alignment:
        indents[k].align === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT,
      keepNext: ["scene", "character", "parenthetical"].includes(k),
      widowControl: true,
    },
  }));
  const paragraphs = d.doc.content.map(
    (b) =>
      new Paragraph({
        style: b.attrs.kind,
        children: (b.content || []).map((s) =>
          s.type === "hard_break"
            ? new TextRun({ break: 1 })
            : new TextRun({
                text: uppercase(b.attrs.kind)
                  ? s.text.toLocaleUpperCase("pt-BR")
                  : s.text,
                bold: s.marks?.some((m) => m.type === "bold"),
                italics: s.marks?.some((m) => m.type === "italic"),
                underline: s.marks?.some((m) => m.type === "underline")
                  ? { type: UnderlineType.SINGLE }
                  : undefined,
              }),
        ),
      }),
  );
  const page = {
    size: {
      width: Math.round(g.width * 20),
      height: Math.round(g.height * 20),
    },
    margin: {
      top: g.top * 20,
      bottom: g.bottom * 20,
      left: g.left * 20,
      right: g.right * 20,
    },
  };
  const cover = d.titlePage
    ? [
        {
          properties: { page },
          children: [
            new Paragraph({
              spacing: { before: 4000, after: 400 },
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: d.title, bold: true, size: 28 })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              text: d.author || "Autor não informado",
            }),
          ],
        },
      ]
    : [];
  const file = new DocxDocument({
    creator: "Elemental Write",
    title: d.title,
    styles: {
      default: { document: { run: { font: "DejaVu Sans Mono", size: 24 } } },
      paragraphStyles: styles,
    },
    sections: [
      ...cover,
      {
        properties: { page: { ...page, pageNumbers: { start: 1 } } },
        headers: { default: new Header({ children: [] }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ children: [PageNumber.CURRENT] })],
              }),
            ],
          }),
        },
        children: paragraphs,
      },
    ],
  });
  return Packer.toBlob(file);
}
const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const elements = (el: Element | Document, name: string) => [
  ...el.getElementsByTagNameNS(ns, name),
];
export async function parseDOCX(file: File) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);
  const entry = zip.file("word/document.xml");
  if (!entry) throw Error("O arquivo não contém um documento Word válido.");
  const xml = parseXml(await entry.async("string"));
  let uncertain = false;
  const paragraphs = elements(xml, "p");
  const styleFile = zip.file("word/styles.xml");
  const styleMap = new Map<string, string>();
  if (styleFile) {
    const styles = parseXml(await styleFile.async("string"));
    elements(styles, "style").forEach((el) =>
      styleMap.set(
        el.getAttributeNS(ns, "styleId") || "",
        elements(el, "name")[0]?.getAttributeNS(ns, "val") || "",
      ),
    );
  }
  let previous: Kind = "action";
  const content: Block[] = [];
  for (const p of paragraphs) {
    const styleId = elements(p, "pStyle")[0]?.getAttributeNS(ns, "val") || "";
    const name = (styleMap.get(styleId) || styleId).toLowerCase();
    let kind = (Object.keys(styleNames) as Kind[]).find(
      (k) => k === name || styleNames[k].toLowerCase() === name,
    );
    const spans: Span[] = [];
    for (const r of elements(p, "r")) {
      const marks: Mark[] = [];
      for (const [tag, type] of [
        ["b", "bold"],
        ["i", "italic"],
        ["u", "underline"],
      ] as const) {
        const el = elements(r, tag)[0];
        if (
          el &&
          !["0", "false", "none"].includes(el.getAttributeNS(ns, "val") || "")
        )
          marks.push({ type });
      }
      for (const c of [...r.children]) {
        if (c.localName === "t" && c.textContent)
          spans.push({
            type: "text",
            text: c.textContent,
            ...(marks.length ? { marks } : {}),
          });
        if (c.localName === "br" && c.getAttributeNS(ns, "type") !== "page")
          spans.push({ type: "hard_break" });
        if (c.localName === "tab") spans.push({ type: "text", text: "    " });
      }
    }
    const t = spans.map((s) => (s.type === "text" ? s.text : "\n")).join("");
    if (!t.trim()) continue;
    if (!kind) {
      uncertain = true;
      kind = /^(INT\.|EXT\.|INT\.\/EXT\.)/i.test(t)
        ? "scene"
        : /^\(.+\)$/.test(t)
          ? "parenthetical"
          : /TO:$/.test(t)
            ? "transition"
            : previous === "character" || (previous as Kind) === "parenthetical"
              ? "dialogue"
              : "action";
    }
    previous = kind;
    content.push({ type: "block", attrs: { kind }, content: spans });
  }
  if (!content.length) throw Error("O DOCX não contém texto importável.");
  return {
    doc: { type: "doc" as const, content },
    warning: uncertain
      ? "Alguns estilos não foram identificados. Revise os tipos dos blocos antes de importar."
      : "Estilos de roteiro reconhecidos. Revise o conteúdo antes de importar.",
  };
}
const fontCache = new Map<string, string>();
async function font(name: string) {
  if (fontCache.has(name)) return fontCache.get(name)!;
  const r = await fetch("/fonts/" + name + ".ttf");
  if (!r.ok) throw Error("Não foi possível carregar a fonte do PDF.");
  const bytes = new Uint8Array(await r.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const encoded = btoa(binary);
  fontCache.set(name, encoded);
  return encoded;
}
export async function pdfExport(d: Manuscript) {
  const { jsPDF } = await import("jspdf");
  const plan = layout(d.doc.content, d.paper);
  const g = plan.geometry;
  const pdf = new jsPDF({
    unit: "pt",
    format: [g.width, g.height],
    compress: true,
  });
  for (const [file, style] of [
    ["DejaVuSansMono", "normal"],
    ["DejaVuSansMono-Bold", "bold"],
    ["DejaVuSansMono-Oblique", "italic"],
    ["DejaVuSansMono-BoldOblique", "bolditalic"],
  ]) {
    pdf.addFileToVFS(file + ".ttf", await font(file));
    pdf.addFont(file + ".ttf", "Screenplay", style);
  }
  pdf.setFont("Screenplay");
  pdf.setFontSize(12);
  if (d.titlePage) {
    pdf.text(d.title, g.width / 2, g.height * 0.4, {
      align: "center",
      maxWidth: g.width - 144,
    });
    pdf.text(
      d.author || "Autor não informado",
      g.width / 2,
      g.height * 0.4 + 65,
      { align: "center" },
    );
    pdf.addPage();
  }
  for (let page = 1; page <= plan.pages; page++) {
    if (page > 1) pdf.addPage();
    pdf.setFont("Screenplay", "normal");
    pdf.text(`${page}.`, g.width - g.right, g.top - 28, { align: "right" });
    for (const line of plan.lines.filter((l) => l.page === page)) {
      const b = d.doc.content[line.blockIndex];
      let offset = 0,
        x = line.x;
      for (const s of b.content || []) {
        const len = s.type === "text" ? s.text.length : 1;
        const a = Math.max(line.start, offset),
          z = Math.min(line.end, offset + len);
        if (z > a && s.type === "text") {
          const text = s.text.slice(a - offset, z - offset);
          const formatted = uppercase(b.attrs.kind)
            ? text.toLocaleUpperCase("pt-BR")
            : text;
          const bold = s.marks?.some((m) => m.type === "bold"),
            italic = s.marks?.some((m) => m.type === "italic");
          pdf.setFont(
            "Screenplay",
            bold && italic
              ? "bolditalic"
              : bold
                ? "bold"
                : italic
                  ? "italic"
                  : "normal",
          );
          pdf.text(formatted, x, line.y + 12);
          const width = pdf.getTextWidth(formatted);
          if (s.marks?.some((m) => m.type === "underline"))
            pdf.line(x, line.y + 14, x + width, line.y + 14);
          x += width;
        }
        offset += len;
      }
    }
  }
  pdf.setProperties({
    title: d.title,
    author: d.author,
    creator: "Elemental Write",
  });
  return pdf.output("blob");
}
export async function parsePDF(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    useSystemFonts: true,
  }).promise;
  const content: Block[] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const text = await page.getTextContent();
      const rows = new Map<number, { x: number; text: string }[]>();
      for (const item of text.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const y = Math.round(item.transform[5] / 3) * 3;
        const row = rows.get(y) || [];
        row.push({ x: item.transform[4], text: item.str });
        rows.set(y, row);
      }
      for (const [, items] of [...rows].sort((a, b) => b[0] - a[0])) {
        items.sort((a, b) => a.x - b.x);
        const t = items.map((i) => i.text).join(" ");
        if (/^\d+\.?$/.test(t.trim())) continue;
        let kind: Kind = "action";
        if (/^(INT\.|EXT\.|INT\.\/EXT\.)/i.test(t)) kind = "scene";
        else if (/^\(/.test(t)) kind = "parenthetical";
        else if (/TO:$|FADE OUT\./.test(t)) kind = "transition";
        else if (items[0].x >= 220 && t === t.toLocaleUpperCase("pt-BR"))
          kind = "character";
        else if (items[0].x >= 165) kind = "dialogue";
        content.push(block(kind, t));
      }
    }
    if (!content.length)
      throw Error(
        "Este PDF não contém texto selecionável. PDFs escaneados precisam de OCR, que não está incluído nesta versão.",
      );
    return {
      doc: { type: "doc" as const, content },
      warning:
        "Importação aproximada de PDF. Quebras de linha e tipos podem precisar de ajustes. Revise todos os blocos.",
    };
  } finally {
    await pdf.destroy();
  }
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export const filename = (title: string) =>
  title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim() || "roteiro";
