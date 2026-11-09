import { useRef, useState } from "react";
import { Bold, Italic, Plus, Trash2, RotateCcw } from "lucide-react";
import { Modal, Field } from "../ui";
import { id, type Manuscript, type Project } from "../model";
import { geometry } from "../editor/layout";
import {
  defaultCover,
  layoutCover,
  type CoverBlock,
  type CoverTemplate,
} from "./model";

export function CoverEditor({
  project,
  documents,
  save,
  close,
}: {
  project: Project;
  documents: Manuscript[];
  save: (cover: CoverTemplate) => Promise<void>;
  close: () => void;
}) {
  const [cover, setCover] = useState(() => project.cover || defaultCover());
  const [selected, setSelected] = useState(cover.blocks[0]?.id || "");
  const [scriptId, setScriptId] = useState(documents[0]?.id || "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const script = documents.find((d) => d.id === scriptId);
  const g = geometry(script?.paper || "letter");
  const context = {
    projeto: project.title,
    roteiro: script?.title || "Nome do roteiro",
    autor: script?.author || "",
  };
  const planned = layoutCover(cover, context, g.width, g.height);
  const overflow = planned.some((b) => b.overflow);
  const current = cover.blocks.find((b) => b.id === selected);
  const update = (patch: Partial<CoverBlock>) =>
    setCover((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) =>
        b.id === selected ? { ...b, ...patch } : b,
      ),
    }));
  const reset = () => {
    const next = defaultCover();
    setCover(next);
    setSelected(next.blocks[0].id);
  };
  const moved = (x: number, y: number, block: CoverBlock) => ({
    x: Math.max(0, Math.min(100 - block.width, x)),
    y: Math.max(0, Math.min(98, y)),
  });
  return (
    <Modal title="Editar capa do projeto" close={close} wide>
      <p className="muted">
        A capa abre todos os PDFs deste projeto. Edite os textos, adicione
        blocos e arraste-os na prévia. Os campos <code>{"{projeto}"}</code>,{" "}
        <code>{"{roteiro}"}</code> e <code>{"{autor}"}</code> acompanham os
        nomes de cada exportação.
      </p>
      <div className="cover-editor">
        <div className="cover-controls">
          <Field label="Roteiro da prévia">
            <select
              value={scriptId}
              onChange={(e) => setScriptId(e.target.value)}
            >
              {!documents.length && (
                <option value="">Exemplo de roteiro</option>
              )}
              {documents.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="cover-block-list" aria-label="Blocos da capa">
            {cover.blocks.map((b, i) => (
              <button
                key={b.id}
                className={selected === b.id ? "selected" : ""}
                aria-pressed={selected === b.id}
                onClick={() => setSelected(b.id)}
              >
                {i + 1}. {b.text.split("\n")[0] || "Contato ou texto livre"}
              </button>
            ))}
          </div>
          <button
            className="cover-add"
            onClick={() => {
              const block: CoverBlock = {
                id: id(),
                text: "Novo texto",
                x: 16,
                y: 65,
                width: 68,
                fontSize: 12,
                align: "center",
                bold: false,
                italic: false,
              };
              setCover({ ...cover, blocks: [...cover.blocks, block] });
              setSelected(block.id);
            }}
          >
            <Plus size={14} /> Adicionar texto
          </button>
          {current && (
            <>
              <Field label="Texto do bloco">
                <textarea
                  aria-label="Texto do bloco"
                  rows={7}
                  value={current.text}
                  onChange={(e) => update({ text: e.target.value })}
                />
              </Field>
              <div className="cover-format">
                <button
                  className={current.bold ? "is-active" : ""}
                  aria-label="Negrito na capa"
                  aria-pressed={current.bold}
                  onClick={() => update({ bold: !current.bold })}
                >
                  <Bold size={16} />
                </button>
                <button
                  className={current.italic ? "is-active" : ""}
                  aria-label="Itálico na capa"
                  aria-pressed={current.italic}
                  onClick={() => update({ italic: !current.italic })}
                >
                  <Italic size={16} />
                </button>
                <select
                  aria-label="Alinhamento do bloco"
                  value={current.align}
                  onChange={(e) =>
                    update({ align: e.target.value as CoverBlock["align"] })
                  }
                >
                  <option value="left">Esquerda</option>
                  <option value="center">Centro</option>
                  <option value="right">Direita</option>
                </select>
              </div>
              <div className="cover-numbers">
                <Field label="Tamanho da fonte">
                  <input
                    type="number"
                    min={8}
                    max={72}
                    value={current.fontSize}
                    onChange={(e) =>
                      update({
                        fontSize: Math.max(
                          8,
                          Math.min(72, Number(e.target.value)),
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="Largura (%)">
                  <input
                    type="number"
                    min={5}
                    max={100 - current.x}
                    value={current.width}
                    onChange={(e) =>
                      update({
                        width: Math.max(
                          5,
                          Math.min(100 - current.x, Number(e.target.value)),
                        ),
                      })
                    }
                  />
                </Field>
                <Field label="Horizontal (%)">
                  <input
                    type="number"
                    min={0}
                    max={100 - current.width}
                    value={Math.round(current.x * 10) / 10}
                    onChange={(e) =>
                      update(moved(Number(e.target.value), current.y, current))
                    }
                  />
                </Field>
                <Field label="Vertical (%)">
                  <input
                    type="number"
                    min={0}
                    max={98}
                    value={Math.round(current.y * 10) / 10}
                    onChange={(e) =>
                      update(moved(current.x, Number(e.target.value), current))
                    }
                  />
                </Field>
              </div>
              <button
                className="cover-remove"
                onClick={() => {
                  const blocks = cover.blocks.filter((b) => b.id !== selected);
                  setCover({ ...cover, blocks });
                  setSelected(blocks[0]?.id || "");
                }}
              >
                <Trash2 size={14} /> Remover bloco
              </button>
            </>
          )}
        </div>
        <div className="cover-preview">
          <svg
            ref={svg}
            viewBox={`0 0 ${g.width} ${g.height}`}
            role="img"
            aria-label="Prévia da capa do roteiro"
          >
            <rect width={g.width} height={g.height} fill="white" />
            {planned.map((b, index) => (
              <g
                key={b.id}
                role="button"
                tabIndex={0}
                aria-label={`Posicionar bloco ${index + 1}`}
                style={{ cursor: "move", touchAction: "none" }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setSelected(b.id);
                  drag.current = {
                    id: b.id,
                    x: b.x,
                    y: b.y,
                    clientX: e.clientX,
                    clientY: e.clientY,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const start = drag.current;
                  if (!start || start.id !== b.id || !svg.current) return;
                  const bounds = svg.current.getBoundingClientRect();
                  const next = moved(
                    start.x +
                      ((e.clientX - start.clientX) / bounds.width) * 100,
                    start.y +
                      ((e.clientY - start.clientY) / bounds.height) * 100,
                    b,
                  );
                  setCover((prev) => ({
                    ...prev,
                    blocks: prev.blocks.map((block) =>
                      block.id === b.id ? { ...block, ...next } : block,
                    ),
                  }));
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
                onKeyDown={(e) => {
                  if (
                    ![
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                    ].includes(e.key)
                  )
                    return;
                  e.preventDefault();
                  setSelected(b.id);
                  const next = moved(
                    b.x +
                      (e.key === "ArrowRight"
                        ? 1
                        : e.key === "ArrowLeft"
                          ? -1
                          : 0),
                    b.y +
                      (e.key === "ArrowDown"
                        ? 1
                        : e.key === "ArrowUp"
                          ? -1
                          : 0),
                    b,
                  );
                  setCover((prev) => ({
                    ...prev,
                    blocks: prev.blocks.map((block) =>
                      block.id === b.id ? { ...block, ...next } : block,
                    ),
                  }));
                }}
              >
                <rect
                  x={b.left}
                  y={b.top}
                  width={b.blockWidth}
                  height={Math.max(25, b.lines.length * b.lineHeight)}
                  fill={selected === b.id ? "#bca16f0c" : "transparent"}
                  stroke={selected === b.id ? "#a48650" : "#ddd"}
                  strokeDasharray="4 4"
                />
                {b.lines.map((line, i) => (
                  <text
                    xmlSpace="preserve"
                    key={i}
                    x={line.x}
                    y={line.y}
                    textAnchor={
                      b.align === "center"
                        ? "middle"
                        : b.align === "right"
                          ? "end"
                          : "start"
                    }
                    fill="black"
                    fontFamily="Script, monospace"
                    fontSize={b.fontSize}
                    fontWeight={b.bold ? 700 : 400}
                    fontStyle={b.italic ? "italic" : "normal"}
                  >
                    {line.text}
                  </text>
                ))}
                {!b.lines.length && (
                  <text x={b.left + 5} y={b.top + 16} fontSize={10} fill="#888">
                    Contato ou texto livre
                  </text>
                )}
              </g>
            ))}
          </svg>
          <small>
            Prévia em {script?.paper === "a4" ? "A4" : "Carta"}. A capa fica sem
            número; o roteiro começa na página 1.
          </small>
        </div>
      </div>
      {overflow && (
        <p className="cover-error" role="alert">
          Um texto ultrapassa a página. Suba o bloco, reduza a fonte ou aumente
          sua largura.
        </p>
      )}
      {error && (
        <p className="cover-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button onClick={reset}>
          <RotateCcw size={14} /> Modelo inicial
        </button>
        <button
          className="primary"
          disabled={busy || overflow}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await save(cover);
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Não foi possível salvar a capa.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Salvando…" : "Salvar capa"}
        </button>
      </div>
    </Modal>
  );
}
