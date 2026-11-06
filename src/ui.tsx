import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <img src="/logo.png" alt="" />
      {!compact && (
        <span>
          Elemental<span className="brand-light"> Write</span>
          <small>ESPAÇO PARA SUAS HISTÓRIAS</small>
        </span>
      )}
    </span>
  );
}
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Fechar" onClick={close}>
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Help({ close }: { close: () => void }) {
  return (
    <Modal title="Seu espaço de escrita" close={close}>
      <p>Escreva um bloco por vez. O editor cuida da formatação.</p>
      <dl className="shortcuts">
        <dt>Enter</dt>
        <dd>Próximo elemento pelo contexto. Depois de uma fala, personagem.</dd>
        <dt>Shift + Enter</dt>
        <dd>Quebra de linha no mesmo bloco.</dd>
        <dt>Tab / Shift + Tab</dt>
        <dd>Avançar / voltar entre tipos de elemento.</dd>
        <dt>↑ ↓ · Enter · Esc</dt>
        <dd>Escolher, aceitar e fechar sugestões de personagens.</dd>
        <dt>Ctrl/⌘ + B, I, U</dt>
        <dd>Negrito, itálico e sublinhado.</dd>
        <dt>Ctrl/⌘ + Z / Shift + Z</dt>
        <dd>Desfazer / refazer.</dd>
        <dt>Ctrl/⌘ + S</dt>
        <dd>Salvar imediatamente.</dd>
      </dl>
      <div className="notice">
        O corretor é o do seu navegador. Ative a verificação ortográfica e o
        dicionário de português (Brasil) para ver sugestões com o botão direito.
      </div>
      <p className="muted">
        Modo local: seus dados pertencem a este navegador. Perfis organizam o
        trabalho, mas não são autenticação segura. Limpar os dados do site pode
        apagar o conteúdo. Exporte backups JSON regularmente.
      </p>
    </Modal>
  );
}
