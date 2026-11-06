import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { makeManuscript, block, textOf } from "../src/model";
import {
  fountainExport,
  parseFountain,
  docxExport,
  fdxExport,
} from "../src/io/formats";
describe("Formatos de intercâmbio", () => {
  it("Fountain preserva o primeiro cabeçalho, parágrafos, falas, quebras e marcas", () => {
    const d = makeManuscript("p", "Coração");
    d.author = "João";
    d.doc = {
      type: "doc",
      content: [
        block("scene", "INT. CASA — DIA"),
        block("action", "Duas linhas\nsem perder palavras"),
        block("character", "LIA"),
        block("parenthetical", "(sorrindo)"),
        block("dialogue", "Você voltou."),
        block("character", "TOMÁS"),
        block("dialogue", "Claro."),
        block("action", "NÃO É UM PERSONAGEM"),
      ],
    };
    const parsed = parseFountain(fountainExport(d));
    expect(parsed.title).toBe(d.title);
    expect(parsed.author).toBe(d.author);
    expect(parsed.doc.content.map(textOf)).toEqual(d.doc.content.map(textOf));
    expect(parsed.doc.content.map((b) => b.attrs.kind)).toEqual(
      d.doc.content.map((b) => b.attrs.kind),
    );
  });
  it("Fountain reconhece cenas e diálogos convencionais sem converter todo texto maiúsculo", () => {
    const parsed = parseFountain(
      "INT. CASA - DIA\n\nUma ação.\n\nLIA\nVocê veio.\n(calmamente)\nEu sabia.\n\nUM AVISO NA PAREDE",
    );
    expect(parsed.doc.content.map((b) => b.attrs.kind)).toEqual([
      "scene",
      "action",
      "character",
      "dialogue",
      "parenthetical",
      "dialogue",
      "action",
    ]);
  });
  it("DOCX contém estilos, margens e texto editável, sem fundo escuro", async () => {
    const d = makeManuscript("p", "Teste");
    d.doc = {
      type: "doc",
      content: [
        block("character", "LIA"),
        block("dialogue", "Ação e memória."),
      ],
    };
    const zip = await JSZip.loadAsync(
      await (await docxExport(d)).arrayBuffer(),
    );
    const doc = await zip.file("word/document.xml")!.async("string");
    const styles = await zip.file("word/styles.xml")!.async("string");
    expect(doc).toContain("Ação e memória.");
    expect(doc).toContain('w:pStyle w:val="character"');
    expect(styles).toContain("Scene Heading");
    expect(styles).toContain('w:left="2880"');
    expect(doc).not.toContain("w:background");
  });
  it("FDX escapa caracteres XML e preserva conteúdo em elementos Text", () => {
    const d = makeManuscript("p", "A & B");
    d.doc = {
      type: "doc",
      content: [block("dialogue", "Você & eu < sempre >")],
    };
    const xml = fdxExport(d);
    expect(xml).toContain("Você &amp; eu &lt; sempre &gt;");
    expect(xml).toContain('Type="Dialogue"');
  });
});
