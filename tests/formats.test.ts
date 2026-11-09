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
  it("Plano e Insert preservam tipos e texto em Fountain e estilos válidos em FDX/DOCX", async () => {
    const d = makeManuscript("p", "Planos");
    d.doc = {
      type: "doc",
      content: [
        block("shot", "PLANO MÉDIO — LIA OBSERVA."),
        block("insert", "INSERT UM RELÓGIO."),
        block("shot", "VOICE OVER (VO) — ERA UMA VEZ."),
      ],
    };
    expect(parseFountain(fountainExport(d)).doc).toEqual(d.doc);
    expect(fdxExport(d).match(/Type="Shot"/g)).toHaveLength(3);
    expect(fdxExport(d)).not.toContain('Type="Insert"');
    const zip = await JSZip.loadAsync(
      await (await docxExport(d)).arrayBuffer(),
    );
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain('w:pStyle w:val="shot"');
    expect(xml).toContain('w:pStyle w:val="insert"');
    expect(xml).toContain("INSERT UM RELÓGIO.");
  });
  it("Fountain preserva parênteses com marcas sem duplicar os sinais", () => {
    const d = makeManuscript("p", "Teste");
    d.doc = {
      type: "doc",
      content: [
        block("character", "LIA"),
        {
          type: "block",
          attrs: { kind: "parenthetical" },
          content: [
            { type: "text", text: "(sussurrando)", marks: [{ type: "bold" }] },
          ],
        },
        block("dialogue", "Mais uma chance."),
      ],
    };
    const exported = fountainExport(d);
    expect(exported).toContain("**(sussurrando)**");
    expect(parseFountain(exported).doc).toEqual(d.doc);
  });
  it("Fountain preserva indicações consecutivas como blocos independentes", () => {
    const d = makeManuscript("p", "Teste");
    d.doc = {
      type: "doc",
      content: [
        block("parenthetical", "(GRITANDO)"),
        block("parenthetical", "(sem perder palavras)"),
      ],
    };
    expect(parseFountain(fountainExport(d)).doc).toEqual(d.doc);
  });
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
  it("DOCX grava o marca-texto amarelo e Fountain/FDX preservam o texto sem estilos inválidos", async () => {
    const d = makeManuscript("p", "Grifo");
    d.doc = {
      type: "doc",
      content: [
        {
          type: "block",
          attrs: { kind: "action" },
          content: [
            {
              type: "text",
              text: "Importante",
              marks: [{ type: "bold" }, { type: "highlight" }],
            },
          ],
        },
      ],
    };
    const zip = await JSZip.loadAsync(
      await (await docxExport(d)).arrayBuffer(),
    );
    expect(await zip.file("word/document.xml")!.async("string")).toContain(
      'w:highlight w:val="yellow"',
    );
    expect(fdxExport(d)).toContain('Style="Bold"');
    expect(fdxExport(d)).not.toContain("undefined");
    expect(fdxExport(d)).not.toContain("Bold+");
    expect(parseFountain(fountainExport(d)).doc.content.map(textOf)).toEqual([
      "Importante",
    ]);
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
