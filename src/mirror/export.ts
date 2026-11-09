import { pdfFont } from "../io/formats";
import { columns, type MirrorData } from "./model";

export function mirrorCSV(mirror: MirrorData) {
  const quoted = (value: string) => '"' + value.replace(/"/g, '""') + '"';
  return (
    "\uFEFF" +
    [
      columns.map(([, label]) => quoted(label)).join(";"),
      ...mirror.rows.map((row) =>
        columns.map(([key]) => quoted(row[key])).join(";"),
      ),
    ].join("\r\n")
  );
}

export async function mirrorPDF(title: string, mirror: MirrorData) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  for (const [file, style] of [
    ["DejaVuSansMono", "normal"],
    ["DejaVuSansMono-Bold", "bold"],
  ]) {
    pdf.addFileToVFS(file + ".ttf", await pdfFont(file));
    pdf.addFont(file + ".ttf", "Mirror", style);
  }
  const margin = 36,
    width = pdf.internal.pageSize.getWidth(),
    bottom = pdf.internal.pageSize.getHeight() - 40;
  const widths = [32, 157, 80, 88, width - margin * 2 - 357];
  const line = 11.5,
    pad = 6;
  let y = margin;
  const pageHeading = () => {
    pdf.setFont("Mirror", "normal");
    pdf.setFontSize(8);
    pdf.text("ELEMENTAL WRITE", margin, y);
    y += 22;
  };
  const newPage = () => {
    pdf.addPage();
    y = margin;
    pageHeading();
  };
  const wrapped = (text: string, w: number): string[] =>
    pdf.splitTextToSize(text || " ", w);
  const writeLines = (lines: string[], size = 9) => {
    for (const text of lines) {
      if (y + line > bottom) newPage();
      pdf.setFontSize(size);
      pdf.text(text, margin, y);
      y += line;
    }
  };
  pageHeading();
  pdf.setFont("Mirror", "bold");
  pdf.setFontSize(14);
  writeLines(wrapped("ESPELHO DE 5 COLUNAS", width - margin * 2), 14);
  y += 12;
  pdf.setFont("Mirror", "normal");
  pdf.setFontSize(11);
  writeLines(wrapped(title, width - margin * 2), 11);
  y += 18;
  const fields = mirror.fields;
  const metadata = [
    [`Roteirista: ${fields.writer || "—"}`, `Status: ${fields.status || "—"}`],
    [
      `Tempo estimado: ${fields.estimatedTime || "—"}`,
      `Revisado por: ${fields.reviewedBy || "—"}`,
    ],
    [
      `Versão: ${fields.version || "—"}`,
      `Aprovado por: ${fields.approvedBy || "—"}`,
    ],
  ];
  pdf.setFont("Mirror", "normal");
  pdf.setFontSize(9);
  for (const pair of metadata) {
    const halves = pair.map((text) =>
      wrapped(text, (width - margin * 2) / 2 - pad * 2),
    );
    let offset = 0;
    const count = Math.max(...halves.map((lines) => lines.length));
    while (offset < count) {
      if (y + line + pad * 2 > bottom) newPage();
      pdf.setFont("Mirror", "normal");
      pdf.setFontSize(9);
      const take = Math.min(
        count - offset,
        Math.floor((bottom - y - pad * 2) / line),
      );
      const height = take * line + pad * 2;
      halves.forEach((lines, i) => {
        const x = margin + (i * (width - margin * 2)) / 2;
        pdf.rect(x, y, (width - margin * 2) / 2, height);
        const chunk = lines.slice(offset, offset + take);
        if (chunk.length)
          pdf.text(chunk, x + pad, y + pad + 8, { lineHeightFactor: line / 9 });
      });
      y += height;
      offset += take;
    }
  }
  y += 22;
  pdf.setFont("Mirror", "bold");
  writeLines(["Anotações de produção:"]);
  pdf.setFont("Mirror", "normal");
  writeLines(wrapped(fields.productionNotes || "—", width - margin * 2));
  y += 14;
  pdf.setTextColor(90, 90, 90);
  writeLines(
    wrapped(
      "Tempo automático: texto falado a 150 palavras/minuto; revise pausas e ações.",
      width - margin * 2,
    ),
    7,
  );
  pdf.setTextColor(0, 0, 0);
  y += 16;
  const tableHeading = () => {
    if (y + 32 > bottom) newPage();
    pdf.setFont("Mirror", "bold");
    pdf.setFontSize(8);
    let x = margin;
    columns.forEach(([, label], i) => {
      pdf.setFillColor(242, 242, 242);
      pdf.rect(x, y, widths[i], 30, "FD");
      pdf.text(wrapped(label, widths[i] - pad * 2), x + pad, y + pad + 8, {
        lineHeightFactor: line / 8,
      });
      x += widths[i];
    });
    y += 30;
    pdf.setFont("Mirror", "normal");
    pdf.setFontSize(8.5);
  };
  tableHeading();
  for (const row of mirror.rows) {
    const cells = columns.map(([key], i) =>
      wrapped(row[key], widths[i] - pad * 2),
    );
    const count = Math.max(1, ...cells.map((c) => c.length));
    const height = count * line + pad * 2;
    if (height <= bottom - margin - 52 && y + height > bottom) {
      newPage();
      tableHeading();
    }
    let offset = 0;
    while (offset < count) {
      if (y + line + pad * 2 > bottom) {
        newPage();
        tableHeading();
      }
      const take = Math.min(
        count - offset,
        Math.floor((bottom - y - pad * 2) / line),
      );
      const rowHeight = take * line + pad * 2;
      let x = margin;
      cells.forEach((cell, i) => {
        pdf.rect(x, y, widths[i], rowHeight);
        const chunk =
          i === 0 && offset > 0 && cell.length === 1
            ? cell
            : cell.slice(offset, offset + take);
        if (chunk.length)
          pdf.text(chunk, x + pad, y + pad + 8.5, {
            lineHeightFactor: line / 8.5,
          });
        x += widths[i];
      });
      y += rowHeight;
      offset += take;
    }
  }
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    pdf.setFont("Mirror", "normal");
    pdf.setFontSize(8);
    pdf.text(
      `${page} / ${pdf.getNumberOfPages()}`,
      width - margin,
      pdf.internal.pageSize.getHeight() - 20,
      { align: "right" },
    );
  }
  return pdf.output("blob");
}
