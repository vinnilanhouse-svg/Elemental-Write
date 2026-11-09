import type { CSSProperties } from "react";
import { Mic, AudioLines } from "lucide-react";
import { Modal } from "./ui";
import { shots, type ShotId } from "./shots";

export function ShotLibrary({
  choose,
  close,
  onChoose,
}: {
  choose: boolean;
  close: () => void;
  onChoose: (id: ShotId) => void;
}) {
  return (
    <Modal
      title={choose ? "Escolha um plano" : "Guia de planos"}
      close={close}
      wide
    >
      <p className="muted">
        {choose
          ? "Escolha o enquadramento ou Voice Over para este bloco. Depois, escreva a descrição."
          : "Uma referência rápida de enquadramentos e narração. Você também pode aplicar uma opção ao bloco atual."}
      </p>
      <div className="shot-grid">
        {shots.map((shot, index) => {
          // Present individual frames from the original generated illustration.
          const x = [26, 440, 853, 1267][index % 4];
          const y = index < 4 ? 134 : 520;
          const width = 379,
            height = index < 4 ? 228 : 237;
          const style: CSSProperties = {
            aspectRatio: `${width} / ${height}`,
            backgroundSize: `${(1672 / width) * 100}% ${(941 / height) * 100}%`,
            backgroundPosition: `${(x / (1672 - width)) * 100}% ${(y / (941 - height)) * 100}%`,
          };
          return (
            <article className="shot-card" key={shot.id}>
              {shot.id === "vo" ? (
                <div
                  className="shot-illustration shot-audio-illustration"
                  role="img"
                  aria-label={`Ilustração: ${shot.description}`}
                  style={{ aspectRatio: "379 / 237" }}
                >
                  <Mic aria-hidden="true" />
                  <AudioLines aria-hidden="true" />
                </div>
              ) : (
                <div
                  className="shot-illustration"
                  role="img"
                  aria-label={`Ilustração: ${shot.description}`}
                  style={style}
                />
              )}
              <div className="shot-card-body">
                <small>{shot.short}</small>
                <h3>{shot.name}</h3>
                <p>{shot.description}</p>
                <button
                  onClick={() => onChoose(shot.id)}
                  aria-label={`Usar ${shot.name.toLocaleLowerCase("pt-BR")}`}
                >
                  Usar este plano
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="shot-footnote muted">
        Os limites dos enquadramentos podem variar conforme a linguagem do
        filme.
      </p>
    </Modal>
  );
}
