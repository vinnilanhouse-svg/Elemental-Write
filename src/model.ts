import type { MirrorData } from "./mirror/model";
import type { CoverTemplate } from "./cover/model";
import type { ProjectIconId } from "./projects/icons";
export const kinds = [
  "scene",
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
  "shot",
  "insert",
] as const;
export type Kind = (typeof kinds)[number];
export const labels: Record<Kind, string> = {
  scene: "Cabeçalho de cena",
  action: "Ação",
  character: "Personagem",
  dialogue: "Diálogo",
  parenthetical: "Parênteses",
  transition: "Transição",
  shot: "Plano",
  insert: "Insert",
};
export type Mark = { type: "bold" | "italic" | "underline" | "highlight" };
export type Span =
  | { type: "text"; text: string; marks?: Mark[] }
  | { type: "hard_break" };
export type Block = { type: "block"; attrs: { kind: Kind }; content?: Span[] };
export type ScriptDoc = { type: "doc"; content: Block[] };
export type Profile = {
  id: string;
  name: string;
  email: string;
  theme: "light" | "dark";
  createdAt: number;
};
export type Project = {
  id: string;
  profileId: string;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  demo?: boolean;
  cover?: CoverTemplate;
  icon?: ProjectIconId;
};
export type Manuscript = {
  id: string;
  projectId: string;
  title: string;
  kind: "script" | "note";
  doc: ScriptDoc;
  body: string;
  author: string;
  paper: "letter" | "a4";
  titlePage: boolean;
  createdAt: number;
  updatedAt: number;
  revision: number;
  mirror?: MirrorData;
};
export const id = () => crypto.randomUUID();
export const block = (kind: Kind = "action", text = ""): Block => ({
  type: "block",
  attrs: { kind },
  ...(text ? { content: [{ type: "text", text }] } : {}),
});
export const emptyDoc = (): ScriptDoc => ({
  type: "doc",
  content: [block("scene")],
});
export const textOf = (b: Block) =>
  b.content?.map((s) => (s.type === "text" ? s.text : "\n")).join("") || "";
export const makeManuscript = (
  projectId: string,
  title: string,
  kind: "script" | "note" = "script",
): Manuscript => ({
  id: id(),
  projectId,
  title,
  kind,
  doc: emptyDoc(),
  body: "",
  author: "",
  paper: "letter",
  titlePage: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  revision: 0,
});
export const nextKind: Record<Kind, Kind> = {
  scene: "action",
  action: "action",
  character: "dialogue",
  dialogue: "character",
  parenthetical: "dialogue",
  transition: "scene",
  shot: "action",
  insert: "action",
};
export const uppercase = (k: Kind) =>
  ["scene", "character", "transition", "shot", "insert"].includes(k);
export const normalizeKind = (kind: Kind, text: string): Kind =>
  kind === "action" && /^(INT\.?\/EXT\.|INT\.|EXT\.)\s/i.test(text)
    ? "scene"
    : kind;
export const characters = (doc: ScriptDoc) => [
  ...new Set(
    doc.content
      .filter((b) => b.attrs.kind === "character")
      .map((b) => textOf(b).trim().toLocaleUpperCase("pt-BR"))
      .filter(Boolean),
  ),
];
