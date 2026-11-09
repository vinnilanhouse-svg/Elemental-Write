import { kinds, type Project, type Manuscript, type ScriptDoc } from "../model";
import { validateMirror } from "../mirror/model";
import { validateCover } from "../cover/model";
export type Backup = {
  format: "elemental-write";
  version: 1;
  exportedAt: string;
  project: Project;
  documents: Manuscript[];
};
export const backup = (project: Project, documents: Manuscript[]): Backup => ({
  format: "elemental-write",
  version: 1,
  exportedAt: new Date().toISOString(),
  project,
  documents,
});
export function validateDoc(value: unknown): value is ScriptDoc {
  if (!value || typeof value !== "object") return false;
  const d = value as ScriptDoc;
  return (
    d.type === "doc" &&
    Array.isArray(d.content) &&
    d.content.length > 0 &&
    d.content.every(
      (b) =>
        b?.type === "block" &&
        kinds.includes(b.attrs?.kind) &&
        (!b.content ||
          (Array.isArray(b.content) &&
            b.content.every(
              (s) =>
                s?.type === "hard_break" ||
                (s?.type === "text" &&
                  typeof s.text === "string" &&
                  s.text.length > 0 &&
                  (!s.marks ||
                    (Array.isArray(s.marks) &&
                      s.marks.every((m) =>
                        ["bold", "italic", "underline", "highlight"].includes(
                          m.type,
                        ),
                      )))),
            ))),
    )
  );
}
export function parseBackup(raw: string): Backup {
  let b: Backup;
  try {
    b = JSON.parse(raw);
  } catch {
    throw Error("O arquivo JSON não é válido.");
  }
  if (b?.format !== "elemental-write" || b.version !== 1)
    throw Error(
      "Backup incompatível. Selecione um backup Elemental Write versão 1.",
    );
  const p = b.project;
  if (
    !p ||
    typeof p.title !== "string" ||
    !p.title.trim() ||
    typeof p.description !== "string" ||
    !Array.isArray(b.documents) ||
    (p.cover !== undefined && !validateCover(p.cover))
  )
    throw Error("O backup não contém um projeto válido.");
  if (
    !b.documents.every(
      (d) =>
        d &&
        typeof d.title === "string" &&
        typeof d.body === "string" &&
        typeof d.author === "string" &&
        ["script", "note"].includes(d.kind) &&
        ["letter", "a4"].includes(d.paper) &&
        typeof d.titlePage === "boolean" &&
        Number.isFinite(d.createdAt) &&
        Number.isFinite(d.updatedAt) &&
        validateDoc(d.doc) &&
        (d.mirror === undefined || validateMirror(d.mirror)),
    )
  )
    throw Error("O backup contém documentos inválidos. Nada foi restaurado.");
  return b;
}
