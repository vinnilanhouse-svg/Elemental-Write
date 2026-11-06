import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { LocalRepository, ConflictError } from "../src/data/repository";
import { makeManuscript, block } from "../src/model";
import { backup, parseBackup } from "../src/io/backup";
const db = () => new LocalRepository("test-" + crypto.randomUUID());
describe("Persistência IndexedDB e backup", () => {
  it("Isola perfis e não recria a demonstração excluída", async () => {
    const r = db();
    const a = await r.addProfile("Ana", "ana@test.com"),
      b = await r.addProfile("Bruno", "b@test.com");
    const pa = await r.projects(a.id),
      pb = await r.projects(b.id);
    expect(pa).toHaveLength(1);
    expect(pa[0].id).not.toBe(pb[0].id);
    await r.deleteProject(pa[0].id);
    expect(await r.projects(a.id)).toEqual([]);
    expect(await r.documents(pa[0].id)).toEqual([]);
    expect(await r.projects(b.id)).toHaveLength(1);
    await r.delete();
  });
  it("Persiste dois roteiros e uma nota; rejeita revisões antigas e exclusões concorrentes", async () => {
    const r = db();
    const p = await r.createProject("ana", "Teste");
    const a = makeManuscript(p.id, "A"),
      b = makeManuscript(p.id, "B"),
      n = makeManuscript(p.id, "Nota", "note");
    await r.createDocument(a);
    await r.createDocument(b);
    await r.createDocument(n);
    const saved = await r.saveDocument(
      {
        ...a,
        doc: { type: "doc", content: [block("dialogue", "Edição recente")] },
      },
      0,
    );
    await expect(
      r.saveDocument({ ...a, title: "Edição antiga" }, 0),
    ).rejects.toBeInstanceOf(ConflictError);
    r.close();
    await r.open();
    const all = await r.documents(p.id);
    expect(all).toHaveLength(3);
    expect(all.find((x) => x.id === a.id)?.revision).toBe(1);
    expect(all.find((x) => x.id === b.id)?.doc).toEqual(b.doc);
    expect(all.find((x) => x.id === n.id)?.kind).toBe("note");
    await r.deleteDocument(a.id);
    await expect(r.saveDocument(saved, 1)).rejects.toBeInstanceOf(
      ConflictError,
    );
    await r.delete();
  });
  it("Backup preserva texto, marcas, metadados e notas em novo projeto", async () => {
    const r = db();
    const p = await r.createProject("ana", "Projeto", "Descrição");
    const a = makeManuscript(p.id, "Roteiro");
    a.author = "Ana";
    a.titlePage = true;
    a.paper = "a4";
    a.doc = {
      type: "doc",
      content: [
        {
          type: "block",
          attrs: { kind: "dialogue" },
          content: [
            {
              type: "text",
              text: "Coração e ação",
              marks: [{ type: "bold" }, { type: "underline" }],
            },
            { type: "hard_break" },
            { type: "text", text: "Mais uma linha" },
          ],
        },
      ],
    };
    const n = makeManuscript(p.id, "Ideias", "note");
    n.body = "Nota com acentuação!";
    const raw = JSON.stringify(backup(p, [a, n]));
    const parsed = parseBackup(raw);
    expect(parsed.documents[0]).toEqual(a);
    const restored = await r.restore("bruno", parsed.project, parsed.documents);
    const docs = await r.documents(restored.id);
    expect(docs.map((x) => x.title).sort()).toEqual(["Ideias", "Roteiro"]);
    expect(docs.find((d) => d.title === "Roteiro")?.doc).toEqual(a.doc);
    expect(docs.find((d) => d.title === "Ideias")?.body).toEqual(n.body);
    expect(restored.profileId).toBe("bruno");
    expect(restored.id).not.toBe(p.id);
    expect(await r.projects("ana")).toHaveLength(1);
    await r.delete();
  });
  it("Rejeita backups incompletos sem gravação parcial", () => {
    expect(() => parseBackup("{}")).toThrow();
    expect(() => parseBackup("{")).toThrow();
    expect(() =>
      parseBackup(JSON.stringify({ format: "elemental-write", version: 2 })),
    ).toThrow();
  });
});
