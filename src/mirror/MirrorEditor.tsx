import { useEffect, useMemo, useRef, type TextareaHTMLAttributes } from "react";
import {
  ArrowLeft,
  Download,
  Plus,
  RefreshCw,
  Table2,
  Trash2,
  Check,
} from "lucide-react";
import { id, type Manuscript } from "../model";
import {
  columns,
  fieldLabels,
  blankCells,
  createMirror,
  updateMirror,
  replaceMirrorRows,
  mirrorSourceHash,
  spokenWordCount,
  type MirrorData,
  type MirrorFields,
} from "./model";

function Cell({
  value,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const resize = () => {
      el.style.height = "0px";
      el.style.height = Math.max(42, el.scrollHeight) + "px";
    };
    resize();
    let previousWidth = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== previousWidth) {
        previousWidth = el.clientWidth;
        resize();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} {...props} />;
}

export function MirrorEditor({
  manuscript,
  fallbackWriter,
  onChange,
  onBack,
  onExport,
  exporting,
}: {
  manuscript: Manuscript;
  fallbackWriter: string;
  onChange: (mirror: MirrorData) => void;
  onBack: () => void;
  onExport: (format: "mirror-pdf" | "mirror-csv" | "json") => void;
  exporting: string;
}) {
  const generated = useMemo(
    () => createMirror(manuscript, fallbackWriter),
    [manuscript.doc, manuscript.author, fallbackWriter],
  );
  const data = manuscript.mirror || generated;
  useEffect(() => {
    if (!manuscript.mirror) onChange(generated);
    else if (manuscript.mirror.mappingVersion !== 2)
      onChange(updateMirror(manuscript.mirror, manuscript, fallbackWriter));
  }, [manuscript.mirror, manuscript, generated, fallbackWriter, onChange]);
  const stale = data.sourceHash !== mirrorSourceHash(manuscript);
  const review = data.rows.filter((r) => r.review).length;
  const setField = (key: keyof MirrorFields, value: string) =>
    onChange({ ...data, fields: { ...data.fields, [key]: value } });
  return (
    <section className="mirror-view" aria-label="Espelho do roteiro">
      <div className="mirror-toolbar">
        <button onClick={onBack}>
          <ArrowLeft size={16} /> Voltar ao roteiro
        </button>
        <div>
          <button
            onClick={() =>
              onChange(updateMirror(data, manuscript, fallbackWriter))
            }
            title="Atualiza os campos automáticos e mantém os ajustes manuais"
          >
            <RefreshCw size={15} /> Atualizar do roteiro
          </button>
          <button onClick={() => onExport("mirror-pdf")} disabled={!!exporting}>
            <Download size={15} /> PDF do espelho
          </button>
          <button onClick={() => onExport("mirror-csv")} disabled={!!exporting}>
            <Table2 size={15} /> Planilha CSV
          </button>
        </div>
      </div>
      {stale && (
        <div className="mirror-notice" role="status">
          O roteiro mudou desde a geração deste espelho. Use{" "}
          <strong>Atualizar do roteiro</strong> para trazer as mudanças e manter
          seus ajustes.
        </div>
      )}
      {!!review && (
        <div className="mirror-notice" role="status">
          {review}{" "}
          {review === 1
            ? "linha com ajustes foi preservada"
            : "linhas com ajustes foram preservadas"}{" "}
          para revisão após mudanças nas falas ou cenas. Confira as linhas
          sinalizadas antes de finalizar.
        </div>
      )}
      <div className="mirror-scroll">
        <div className="mirror-sheet">
          <div className="mirror-heading">
            <span className="eyebrow">ELEMENTAL WRITE · PRODUÇÃO</span>
            <h1>Espelho de 5 colunas</h1>
            <p>{manuscript.title}</p>
          </div>
          <div className="mirror-fields">
            {(Object.keys(fieldLabels) as (keyof MirrorFields)[])
              .filter((key) => key !== "productionNotes")
              .map((key) => (
                <label key={key}>
                  <span>{fieldLabels[key]}:</span>
                  <input
                    aria-label={fieldLabels[key]}
                    value={data.fields[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    placeholder={
                      key === "reviewedBy" || key === "approvedBy"
                        ? "A preencher"
                        : "—"
                    }
                  />
                </label>
              ))}
          </div>
          <p className="mirror-estimate">
            Tempo automático: texto falado a 150 palavras/minuto. Ajuste para
            incluir pausas e ações.
          </p>
          <label className="mirror-notes">
            <span>Anotações de produção:</span>
            <Cell
              aria-label="Anotações de produção"
              value={data.fields.productionNotes}
              onChange={(e) => setField("productionNotes", e.target.value)}
              placeholder="Observações para a equipe…"
            />
          </label>
          <p className="mirror-hint">
            Uma linha por fala. A cena se repete em cada linha; todos os campos
            podem ser ajustados. Os blocos Insert preenchem Lettering
            automaticamente.
          </p>
          <div
            className="mirror-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Tabela editável do espelho"
          >
            <table className="mirror-table">
              <caption className="sr-only">
                Espelho de {manuscript.title}: uma linha por fala, agrupada por
                cena.
              </caption>
              <colgroup>
                {columns.map(([key]) => (
                  <col key={key} className={`mirror-col-${key}`} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {columns.map(([key, label]) => (
                    <th key={key} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={row.review ? "mirror-review-row" : ""}
                  >
                    {columns.map(([key, label]) => (
                      <td key={key}>
                        <Cell
                          aria-label={`${label} · linha ${index + 1}`}
                          value={row[key]}
                          onChange={(e) =>
                            onChange(
                              replaceMirrorRows(
                                data,
                                data.rows.map((r) =>
                                  r.id === row.id
                                    ? { ...r, [key]: e.target.value }
                                    : r,
                                ),
                              ),
                            )
                          }
                        />
                        {key === "scene" && (
                          <div className="mirror-row-actions">
                            {row.review && (
                              <button
                                className="icon-button"
                                title="Concluir revisão desta linha"
                                aria-label={`Concluir revisão da linha ${index + 1}`}
                                onClick={() =>
                                  onChange({
                                    ...data,
                                    rows: data.rows.map((r) =>
                                      r.id === row.id
                                        ? { ...r, review: false }
                                        : r,
                                    ),
                                  })
                                }
                              >
                                <Check size={13} />
                              </button>
                            )}
                            <button
                              className="icon-button"
                              title="Excluir linha do espelho"
                              aria-label={`Excluir linha ${index + 1} do espelho`}
                              onClick={() =>
                                onChange({
                                  ...replaceMirrorRows(
                                    data,
                                    data.rows.filter((r) => r.id !== row.id),
                                  ),
                                  deletedSourceKeys: row.sourceKey
                                    ? [
                                        ...new Set([
                                          ...data.deletedSourceKeys,
                                          row.sourceKey,
                                        ]),
                                      ]
                                    : data.deletedSourceKeys,
                                })
                              }
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.rows.length && (
              <p className="mirror-empty">
                O espelho está vazio. Escreva no roteiro e atualize ou adicione
                uma linha.
              </p>
            )}
          </div>
          <button
            className="mirror-add"
            onClick={() =>
              onChange(
                replaceMirrorRows(data, [
                  ...data.rows,
                  { id: id(), ...blankCells(data.rows.at(-1)?.scene || "1") },
                ]),
              )
            }
          >
            <Plus size={15} /> Adicionar linha
          </button>
          <div className="mirror-bottom">
            <span>
              {data.rows.length} linhas · {spokenWordCount(data.rows)} palavras
              faladas
            </span>
            <span>
              Os ajustes ficam no espelho. O texto do roteiro é preservado.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
