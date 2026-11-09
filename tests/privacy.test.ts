import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { LocalRepository, ConflictError } from "../src/data/repository";
import { makeManuscript, block } from "../src/model";
import { defaultCover } from "../src/cover/model";
import { createMirror } from "../src/mirror/model";
import { personalDataArchive } from "../src/privacy/archive";
import {
  acknowledgeNotice,
  noticeAcknowledged,
  privacy,
} from "../src/privacy/config";
import { parseBackup } from "../src/io/backup";
const database = () => new LocalRepository("privacy-" + crypto.randomUUID());
describe("Direitos e privacidade dos dados locais", () => {
  it("Permite e-mail vazio e corrige apenas os dados do perfil preservando autoria e tema", async () => {
    const r = database();
    const a = await r.addProfile("Apelido");
    expect(a.email).toBe("");
    const p = (await r.projects(a.id))[0];
    const original = (await r.documents(p.id))[0];
    await r.theme(a.id, "light");
    const updated = await r.updateProfile(a.id, "  Outro nome  ", "");
    expect(updated.name).toBe("Outro nome");
    expect(updated.theme).toBe("light");
    expect(updated.createdAt).toBe(a.createdAt);
    expect((await r.documents(p.id))[0].author).toBe(original.author);
    await expect(r.updateProfile(a.id, " ", "")).rejects.toThrow("Confira");
    await r.delete();
  });
  it("Exporta perfil e projetos com conteúdo completo sem incluir dados de outros perfis", async () => {
    const r = database();
    const a = await r.addProfile("Ana", "ana@example.com"),
      b = await r.addProfile("Bruno", "bruno@example.com");
    const p = (await r.projects(a.id))[0];
    const cover = defaultCover();
    await r.saveProjectCover(p.id, cover);
    await r.saveProjectIcon(p.id, "car");
    const doc = makeManuscript(p.id, "Meu roteiro");
    doc.doc = {
      type: "doc",
      content: [
        block("scene", "INT. CASA — DIA"),
        block("character", "ANA"),
        block("dialogue", "Texto pessoal."),
      ],
    };
    doc.mirror = createMirror(doc);
    await r.createDocument(doc);
    const snapshot = await r.exportProfile(a.id);
    expect(snapshot.profile.id).toBe(a.id);
    expect(
      snapshot.projects.every((entry) => entry.project.profileId === a.id),
    ).toBe(true);
    const archive = await JSZip.loadAsync(
      await (await personalDataArchive(snapshot)).arrayBuffer(),
    );
    const profile = JSON.parse(
      await archive.file("perfil.json")!.async("string"),
    );
    expect(profile.profile.email).toBe("ana@example.com");
    const entries = Object.keys(archive.files).filter(
      (path) => path.startsWith("projetos/") && path.endsWith(".json"),
    );
    expect(entries).toHaveLength(snapshot.projects.length);
    const data = parseBackup(await archive.file(entries[0])!.async("string"));
    expect(data.project.cover).toEqual(cover);
    expect(data.project.icon).toBe("car");
    expect(data.documents.find((d) => d.id === doc.id)?.mirror).toEqual(
      doc.mirror,
    );
    expect(JSON.stringify(data)).not.toContain(b.email);
    await r.delete();
  });
  it("Exclui somente o perfil selecionado e impede novas gravações, restaurações ou projetos órfãos", async () => {
    const r = database();
    const a = await r.addProfile("Ana"),
      b = await r.addProfile("Bruno");
    const pa = (await r.projects(a.id))[0],
      pb = (await r.projects(b.id))[0];
    const da = (await r.documents(pa.id))[0];
    const other = await r.exportProfile(b.id);
    await r.deleteProfile(a.id);
    expect((await r.profiles()).map((p) => p.id)).toEqual([b.id]);
    expect(await r.projects(a.id)).toEqual([]);
    expect(await r.documents(pa.id)).toEqual([]);
    expect(await r.exportProfile(b.id)).toEqual(other);
    await expect(r.saveDocument(da, da.revision)).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(
      r.createDocument(makeManuscript(pa.id, "Não recriar")),
    ).rejects.toThrow("projeto foi removido");
    await expect(r.createProject(a.id, "Não recriar")).rejects.toThrow(
      "perfil foi removido",
    );
    await expect(r.restore(a.id, pa, [da])).rejects.toThrow(
      "perfil foi removido",
    );
    await expect(r.exportProfile(a.id)).rejects.toThrow("perfil foi removido");
    await expect(r.updateProfile(a.id, "Ana", "")).rejects.toThrow(
      "perfil foi removido",
    );
    r.close();
    await r.open();
    expect(await r.people.get(a.id)).toBeUndefined();
    expect((await r.documents(pb.id)).length).toBeGreaterThan(0);
    await r.delete();
  });
  it("Uma falha de exclusão reverte a operação inteira", async () => {
    const r = database();
    const a = await r.addProfile("Ana");
    const before = await r.exportProfile(a.id);
    r.people.hook("deleting", () => {
      throw Error("Falha de exclusão");
    });
    await expect(r.deleteProfile(a.id)).rejects.toThrow("Falha de exclusão");
    expect(await r.exportProfile(a.id)).toEqual(before);
    await r.delete();
  });
  it("Entendi registra somente a versão e a leitura do aviso, sem consentimento de publicidade", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) || null,
      setItem: (key: string, value: string) => data.set(key, value),
    });
    try {
      expect(noticeAcknowledged()).toBe(false);
      acknowledgeNotice();
      expect(noticeAcknowledged()).toBe(true);
      const record = JSON.parse(data.get(privacy.noticeKey)!);
      expect(Object.keys(record).sort()).toEqual(["acknowledgedAt", "version"]);
      data.set(privacy.noticeKey, "invalid");
      expect(noticeAcknowledged()).toBe(false);
      data.set(
        privacy.noticeKey,
        JSON.stringify({ version: "old", acknowledgedAt: "2026-01-01" }),
      );
      expect(noticeAcknowledged()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("As páginas públicas identificam o responsável e as duas formas de hospedagem aplicam as mesmas restrições", async () => {
    for (const file of ["privacidade.html", "termos.html"]) {
      const html = await readFile(
        new URL("../" + file, import.meta.url),
        "utf8",
      );
      expect(html).toContain(privacy.controller);
      expect(html).toContain(privacy.email);
      expect(html).not.toContain("<script");
    }
    const config = JSON.parse(
      await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    );
    const local = JSON.parse(
      await readFile(
        new URL("../localhost/security-headers.json", import.meta.url),
        "utf8",
      ),
    );
    expect(
      Object.fromEntries(
        config.headers[0].headers.map((h: { key: string; value: string }) => [
          h.key,
          h.value,
        ]),
      ),
    ).toEqual(local);
    expect(local["Content-Security-Policy"]).toContain("connect-src 'self'");
    expect(local["Content-Security-Policy"]).toContain("script-src 'self'");
    expect(local["Referrer-Policy"]).toBe("no-referrer");
  });
});
