import { useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { Modal } from "../ui";
import type { Project } from "../model";
import { ProjectIcon } from "./ProjectIcon";
import { projectIcons, type ProjectIconId } from "./icons";

export function IconPicker({
  project,
  save,
  close,
}: {
  project: Project;
  save: (icon: ProjectIconId) => Promise<void>;
  close: () => void;
}) {
  const [selected, setSelected] = useState<ProjectIconId>(
    project.icon || "clapperboard",
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title="Escolher ícone" close={close} wide>
      <p className="muted">
        Escolha um dos 20 ícones para <strong>{project.title}</strong>.
      </p>
      <div className="project-icon-preview">
        <ProjectIcon name={selected} size={36} strokeWidth={1.2} />
        <div>
          <strong>{project.title}</strong>
          <span>
            {projectIcons.find((icon) => icon.id === selected)?.label}
          </span>
        </div>
      </div>
      <div
        className="project-icon-grid"
        role="group"
        aria-label="Opções de ícone"
      >
        {projectIcons.map((icon) => (
          <button
            key={icon.id}
            className={
              "project-icon-choice " + (selected === icon.id ? "selected" : "")
            }
            aria-label={`Usar ícone ${icon.label}`}
            aria-pressed={selected === icon.id}
            onClick={() => setSelected(icon.id)}
          >
            {selected === icon.id && (
              <Check
                className="project-icon-check"
                size={13}
                aria-hidden="true"
              />
            )}
            <ProjectIcon name={icon.id} size={30} strokeWidth={1.2} />
            <span>{icon.label}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className="project-icon-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions project-icon-actions">
        <button onClick={close}>Cancelar</button>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await save(selected);
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Não foi possível salvar o ícone.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <>
              <LoaderCircle size={15} className="spin" /> Salvando…
            </>
          ) : (
            "Salvar ícone"
          )}
        </button>
      </div>
    </Modal>
  );
}
