import { id, textOf, type Manuscript, type ScriptDoc } from "../model";
import { shotPrefix } from "../shots";

export const columns = [
  ["scene", "Cena"],
  ["spoken", "Texto falado"],
  ["delivery", "Indicação da fala"],
  ["lettering", "Lettering"],
  ["description", "Descrição de cena"],
] as const;
export type MirrorColumn = (typeof columns)[number][0];
export type MirrorCells = Record<MirrorColumn, string>;
export const fieldLabels = {
  writer: "Roteirista",
  status: "Status",
  estimatedTime: "Tempo estimado",
  reviewedBy: "Revisado por",
  version: "Versão",
  approvedBy: "Aprovado por",
  productionNotes: "Anotações de produção",
} as const;
export type MirrorFields = Record<keyof typeof fieldLabels, string>;
export type MirrorRow = MirrorCells & {
  id: string;
  sourceKey?: string;
  base?: MirrorCells;
  review?: boolean;
};
export type MirrorData = {
  version: 1;
  mappingVersion?: 2;
  sourceHash: string;
  fields: MirrorFields;
  baseFields: MirrorFields;
  rows: MirrorRow[];
  deletedSourceKeys: string[];
  generatedAt: number;
};
export const blankCells = (scene = ""): MirrorCells => ({
  scene,
  spoken: "",
  delivery: "",
  lettering: "",
  description: "",
});
const fingerprint = (text: string) => {
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `${text.length}-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
};
export const mirrorSourceHash = (d: Pick<Manuscript, "doc" | "author">) =>
  fingerprint(JSON.stringify([d.doc, d.author]));
const join = (...values: string[]) => values.filter(Boolean).join("\n");
const unwrap = (text: string) => text.trim().replace(/^["“«](.*)["”»]$/s, "$1");
export function spokenWordCount(rows: MirrorCells[]) {
  return rows.reduce(
    (total, row) =>
      total +
      (row.spoken.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu)?.length ||
        0),
    0,
  );
}
export function estimatedTime(rows: MirrorCells[]) {
  const count = spokenWordCount(rows);
  if (!count) return "";
  const seconds = Math.ceil((count * 60) / 150);
  return seconds < 60
    ? `${seconds} s`
    : `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} s` : ""}`;
}

// Each dialogue block is one row, even when the speaker or scene repeats.
export function generateRows(doc: ScriptDoc): MirrorRow[] {
  const rows: MirrorRow[] = [];
  const occurrences = new Map<string, number>();
  let scene = 0,
    heading = "",
    speaker = "";
  let directions: string[] = [],
    lettering: string[] = [],
    asides: string[] = [];
  let sceneStart = 0,
    hasScene = false,
    pendingVO = false;
  const emit = (spoken = "", voiceOver = false) => {
    const cue = join(speaker, ...asides);
    const isVO =
      voiceOver ||
      /\(\s*V\.?\s*O\.?\s*\)|\bVOICE OVER\b|\bVOZ EM OFF\b/i.test(cue);
    const indication =
      isVO || /\(\s*(?:O\.?\s*S\.?|OFF)\s*\)/i.test(cue)
        ? "Off" + (isVO ? " (VO)" : "")
        : "Vivo";
    const cleanSpeaker = speaker
      .replace(/\s*\((?:V\.?\s*O\.?|O\.?\s*S\.?|OFF)\)\s*$/i, "")
      .trim();
    const cells: MirrorCells = {
      scene: scene ? String(scene) : "—",
      spoken,
      delivery: spoken
        ? join(
            [cleanSpeaker, indication].filter(Boolean).join(" · "),
            ...asides,
          )
        : join(speaker, ...asides),
      lettering: lettering.join("\n"),
      description: join(heading, ...directions),
    };
    const signature = fingerprint(JSON.stringify([heading, speaker, spoken]));
    const occurrence = (occurrences.get(signature) || 0) + 1;
    occurrences.set(signature, occurrence);
    rows.push({
      ...cells,
      id: id(),
      sourceKey: `${signature}-${occurrence}`,
      base: { ...cells },
    });
    directions = [];
    lettering = [];
    asides = [];
    pendingVO = false;
  };
  const finishScene = () => {
    if (pendingVO) directions.push("VOICE OVER (VO)");
    if (rows.length === sceneStart) {
      if (
        hasScene ||
        directions.length ||
        lettering.length ||
        asides.length ||
        speaker
      )
        emit();
    } else if (directions.length || lettering.length || asides.length) {
      const last = rows[rows.length - 1];
      last.description = join(last.description, ...directions, ...asides);
      last.lettering = join(last.lettering, ...lettering);
      last.base = {
        ...last.base!,
        description: last.description,
        lettering: last.lettering,
      };
    }
    directions = [];
    lettering = [];
    asides = [];
    speaker = "";
    pendingVO = false;
    sceneStart = rows.length;
  };
  for (const block of doc.content) {
    const text = textOf(block).trim();
    if (block.attrs.kind === "scene") {
      finishScene();
      scene++;
      hasScene = true;
      heading = text.toLocaleUpperCase("pt-BR");
      continue;
    }
    if (!text) continue;
    if (block.attrs.kind === "character") {
      // An unfinished parenthetical still belongs in the production directions.
      directions.push(...asides);
      asides = [];
      speaker = text.toLocaleUpperCase("pt-BR");
      continue;
    }
    if (block.attrs.kind === "parenthetical") {
      asides.push(text);
      continue;
    }
    if (block.attrs.kind === "dialogue") {
      emit(text, pendingVO);
      continue;
    }
    if (block.attrs.kind === "insert") {
      const content = text
        .replace(/^INSERT\b\s*[:—-]?\s*/i, "")
        .replace(
          /^(?:LETTERING|TEXTO NA TELA|LETREIRO|GC|SUPER|LEGENDA|TÍTULO NA TELA)\s*[:—-]\s*/i,
          "",
        );
      const caption = unwrap(content);
      if (caption) lettering.push(caption);
      continue;
    }
    if (
      block.attrs.kind === "shot" &&
      /^(?:VOICE OVER(?:\s*\(VO\))?|VO)(?:\s*[—:-]|$)/i.test(text)
    ) {
      const narration = text.slice(shotPrefix(text).length).trim();
      if (narration) {
        const previousSpeaker = speaker;
        speaker = "";
        emit(narration, true);
        speaker = previousSpeaker;
      } else pendingVO = true;
      continue;
    }
    const visual = ["shot", "transition"].includes(block.attrs.kind)
      ? text.toLocaleUpperCase("pt-BR")
      : text;
    directions.push(visual);
    // Other block types still require an explicit screen-text marker.
    const screenText = text.match(
      /(?:^|\n|^INSERT\s*[—:-]?\s*)(?:LETTERING|TEXTO NA TELA|LETREIRO|GC|SUPER|LEGENDA|TÍTULO NA TELA)\s*[:—-]\s*([\s\S]+)/i,
    );
    if (screenText) lettering.push(unwrap(screenText[1]));
  }
  finishScene();
  return rows;
}

export function createMirror(d: Manuscript, fallbackWriter = ""): MirrorData {
  const rows = generateRows(d.doc);
  const fields: MirrorFields = {
    writer: d.author || fallbackWriter,
    status: "Rascunho",
    estimatedTime: estimatedTime(rows),
    reviewedBy: "",
    version: "1",
    approvedBy: "",
    productionNotes: "",
  };
  return {
    version: 1,
    mappingVersion: 2,
    sourceHash: mirrorSourceHash(d),
    fields,
    baseFields: { ...fields },
    rows,
    deletedSourceKeys: [],
    generatedAt: Date.now(),
  };
}
export const hasManualChanges = (row: MirrorRow) =>
  !row.base || columns.some(([key]) => row[key] !== row.base![key]);
export function replaceMirrorRows(
  data: MirrorData,
  rows: MirrorRow[],
): MirrorData {
  if (data.fields.estimatedTime !== data.baseFields.estimatedTime)
    return { ...data, rows };
  const time = estimatedTime(rows);
  return {
    ...data,
    rows,
    fields: { ...data.fields, estimatedTime: time },
    baseFields: { ...data.baseFields, estimatedTime: time },
  };
}

export function updateMirror(
  previous: MirrorData,
  d: Manuscript,
  fallbackWriter = "",
): MirrorData {
  const generated = createMirror(d, fallbackWriter);
  const oldRows = new Map(
    previous.rows.filter((r) => r.sourceKey).map((r) => [r.sourceKey!, r]),
  );
  const matched = new Set<string>();
  const deleted = new Set(previous.deletedSourceKeys);
  const rows = generated.rows
    .filter((row) => !deleted.has(row.sourceKey!))
    .map((row) => {
      const old = oldRows.get(row.sourceKey!);
      if (!old) return row;
      matched.add(old.id);
      for (const [key] of columns)
        if (old.base && old[key] !== old.base[key]) row[key] = old[key];
      row.id = old.id;
      return row;
    });
  for (const old of previous.rows) {
    if (matched.has(old.id) || !hasManualChanges(old)) continue;
    // Preserve unmatched edits as explicit review rows instead of dropping them.
    const { sourceKey, base: _base, ...manual } = old;
    rows.push({ ...manual, ...(sourceKey ? { review: true } : {}) });
  }
  const fields = { ...generated.fields };
  for (const key of Object.keys(fieldLabels) as (keyof MirrorFields)[])
    if (previous.fields[key] !== previous.baseFields[key])
      fields[key] = previous.fields[key];
  if (previous.fields.estimatedTime === previous.baseFields.estimatedTime)
    fields.estimatedTime = generated.baseFields.estimatedTime =
      estimatedTime(rows);
  return {
    ...generated,
    rows,
    fields,
    deletedSourceKeys: [...previous.deletedSourceKeys],
  };
}

const recordOfStrings = (value: unknown, keys: readonly string[]) =>
  !!value &&
  typeof value === "object" &&
  keys.every((k) => typeof (value as Record<string, unknown>)[k] === "string");
export function validateMirror(value: unknown): value is MirrorData {
  if (!value || typeof value !== "object") return false;
  const m = value as MirrorData;
  return (
    m.version === 1 &&
    (m.mappingVersion === undefined || m.mappingVersion === 2) &&
    typeof m.sourceHash === "string" &&
    Number.isFinite(m.generatedAt) &&
    recordOfStrings(m.fields, Object.keys(fieldLabels)) &&
    recordOfStrings(m.baseFields, Object.keys(fieldLabels)) &&
    Array.isArray(m.deletedSourceKeys) &&
    m.deletedSourceKeys.every((k) => typeof k === "string") &&
    Array.isArray(m.rows) &&
    new Set(m.rows.map((r) => r?.id)).size === m.rows.length &&
    m.rows.every(
      (r) =>
        !!r &&
        typeof r.id === "string" &&
        !!r.id &&
        recordOfStrings(
          r,
          columns.map(([key]) => key),
        ) &&
        (r.sourceKey === undefined || typeof r.sourceKey === "string") &&
        (r.review === undefined || typeof r.review === "boolean") &&
        (r.base === undefined ||
          recordOfStrings(
            r.base,
            columns.map(([key]) => key),
          )),
    )
  );
}
