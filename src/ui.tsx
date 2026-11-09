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
export function Drawer({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          const bounds = ref.current.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            close();
        }
      }}
    >
      <div className="drawer-frame">
        <header className="drawer-header">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Fechar painel"
            onClick={close}
          >
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
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
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
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
      <p>
        Clique em Elemental Write, no canto superior esquerdo, para abrir seus
        projetos, roteiros e notas. O botão Cenas abre o índice do roteiro.
        Importação, tema e configurações da página ficam no menu de três pontos.
      </p>
      <p>
        As cenas são numeradas automaticamente à direita do cabeçalho. Escolha
        Plano no seletor para definir um enquadramento; o ícone de câmera abre o
        guia ilustrado. Insert começa com INSERT, pronto para a descrição.
      </p>
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
