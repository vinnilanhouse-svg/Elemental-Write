import { useEffect, useState } from "react";
import { Download, Mail, ShieldCheck, Trash2 } from "lucide-react";
import { Modal, Field } from "../ui";
import { repository, cloudMode } from "../data/repository";
import type { Profile } from "../model";
import type { ProfileSnapshot } from "./archive";
import { PrivacyLinks } from "./PrivacyNotice";
import { privacy } from "./config";

export function PrivacyCenter({
  profile,
  close,
  update,
  exportData,
  remove,
  reviewNotice,
}: {
  profile: Profile | null;
  close: () => void;
  update: (name: string, email: string) => Promise<void>;
  exportData: () => Promise<void>;
  remove: (password?: string) => Promise<void>;
  reviewNotice: () => void;
}) {
  const [name, setName] = useState(profile?.name || ""),
    [email, setEmail] = useState(profile?.email || "");
  const [password, setPassword] = useState("");
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [confirming, setConfirming] = useState(false),
    [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    let alive = true;
    if (profile)
      repository
        .exportProfile(profile.id)
        .then((value) => {
          if (alive) setSnapshot(value);
        })
        .catch((e) => {
          if (alive)
            setError(
              e instanceof Error
                ? e.message
                : "Não foi possível consultar os dados.",
            );
        });
    return () => {
      alive = false;
    };
  }, [profile?.id]);
  const run = async (
    label: string,
    action: () => Promise<void>,
    result = "",
  ) => {
    setBusy(label);
    setError("");
    setSuccess("");
    try {
      await action();
      setSuccess(result);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível concluir a operação.",
      );
    } finally {
      setBusy("");
    }
  };
  return (
    <Modal title="Privacidade e seus dados" close={close} wide>
      <div className="privacy-controller">
        <ShieldCheck size={21} aria-hidden="true" />
        <div>
          <strong>{privacy.controller}</strong>
          <a
            href={`mailto:${privacy.email}?subject=Solicita%C3%A7%C3%A3o%20sobre%20dados%20pessoais%20-%20Elemental%20Write`}
          >
            <Mail size={13} />
            {privacy.email}
          </a>
        </div>
      </div>
      <PrivacyLinks />
      {confirming && profile ? (
        <section className="privacy-delete-confirm">
          <h3>Excluir perfil ou conta e todos os seus dados?</h3>
          <p>
            O perfil <strong>{profile.name}</strong>, seus projetos, roteiros,
            notas, capas e espelhos serão removidos do armazenamento ativo
            (nuvem para contas; navegador para perfis locais). Alterações ainda
            não salvas também serão descartadas. Outros perfis serão mantidos.
          </p>
          <p>
            Arquivos já exportados e cópias em outros dispositivos não são
            apagados por esta ação. Você pode baixar seus dados antes de
            excluir.
          </p>
          <button
            className="secondary"
            disabled={!!busy}
            onClick={() => run("export", exportData, "Backup baixado.")}
          >
            <Download size={15} />
            Baixar meus dados
          </button>
          <Field label="Digite EXCLUIR para confirmar">
            <input
              autoFocus
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </Field>
          {cloudMode && (
            <Field label="Confirme sua senha atual">
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}
          <div className="modal-actions">
            <button
              disabled={!!busy}
              onClick={() => {
                setConfirming(false);
                setConfirmation("");
                setPassword("");
              }}
            >
              Voltar
            </button>
            <button
              className="danger privacy-delete-button"
              disabled={
                !!busy || confirmation !== "EXCLUIR" || (cloudMode && !password)
              }
              onClick={() => run("delete", () => remove(password))}
            >
              <Trash2 size={15} />
              {busy === "delete" ? "Excluindo…" : "Excluir definitivamente"}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="privacy-storage">
            <h3>Cookies e armazenamento</h3>
            <p>
              A aplicação não usa cookies de publicidade ou de análise. O
              armazenamento local é necessário para salvar seus roteiros, manter
              o perfil ativo e lembrar que este aviso foi lido. Não há cookies
              opcionais para aceitar ou rejeitar nesta versão.
            </p>
            <p>
              Ao usar uma conta, seus dados são enviados ao Supabase por
              solicitação da Elemental Corp para autenticação e armazenamento.
              No modo local, ficam no navegador. Ao acessar o site publicado, a
              hospedagem pode tratar dados técnicos de acesso, como IP e
              horário, para entregar e proteger o serviço.
            </p>
            <button className="text-button" onClick={reviewNotice}>
              Rever aviso de armazenamento
            </button>
          </section>
          {profile ? (
            <>
              <section className="privacy-profile">
                <h3>Consultar e corrigir o perfil</h3>
                <p>
                  {cloudMode
                    ? "Conta autenticada por e-mail e senha. Mudanças de e-mail exigem confirmação por e-mail; o endereço atual permanece até confirmar."
                    : "Perfil local sem senha. O e-mail é opcional."}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(
                      "update",
                      () => update(name.trim(), email.trim()),
                      "Perfil atualizado.",
                    );
                  }}
                >
                  <div className="privacy-profile-fields">
                    <Field label="Nome ou apelido">
                      <input
                        required
                        maxLength={120}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </Field>
                    <Field
                      label={
                        cloudMode
                          ? "E-mail da conta"
                          : "E-mail do perfil (opcional)"
                      }
                    >
                      <input
                        type="email"
                        maxLength={254}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </Field>
                  </div>
                  <button
                    className="secondary"
                    type="submit"
                    disabled={!!busy || !name.trim()}
                  >
                    {busy === "update" ? "Salvando…" : "Salvar dados do perfil"}
                  </button>
                </form>
                <p className="muted">
                  Nomes já escritos em roteiros e capas continuam editáveis nos
                  respectivos documentos.
                </p>
              </section>
              <section className="privacy-export">
                <h3>Baixar seus dados</h3>
                {snapshot && (
                  <p>
                    {snapshot.projects.length} projetos ·{" "}
                    {snapshot.projects.reduce(
                      (n, p) => n + p.documents.length,
                      0,
                    )}{" "}
                    documentos gravados neste perfil. Criado em{" "}
                    {new Intl.DateTimeFormat("pt-BR").format(profile.createdAt)}
                    .
                  </p>
                )}
                <p>
                  O ZIP inclui os dados do perfil e um backup JSON de cada
                  projeto, com roteiros, notas, capas, ícones e espelhos. Para
                  restaurar, importe os JSON da pasta projetos. Salve alterações
                  em outras abas antes de exportar.
                </p>
                <button
                  className="secondary"
                  disabled={!!busy}
                  onClick={() =>
                    run("export", exportData, "Seus dados foram baixados.")
                  }
                >
                  <Download size={15} />
                  {busy === "export"
                    ? "Preparando arquivo…"
                    : "Baixar meus dados"}
                </button>
              </section>
              <section className="privacy-delete">
                <h3>Excluir perfil ou conta</h3>
                <p>
                  {cloudMode
                    ? "A exclusão da conta é executada pelo servidor após confirmar sua senha e remove os projetos na nuvem. Cópias locais e arquivos exportados permanecem sob seu controle."
                    : "A exclusão remove este perfil e seus projetos deste navegador. Arquivos exportados permanecem sob seu controle."}
                </p>
                <button
                  className="danger"
                  disabled={!!busy}
                  onClick={() => setConfirming(true)}
                >
                  <Trash2 size={15} />
                  Excluir meu perfil e dados
                </button>
              </section>
            </>
          ) : (
            <p className="privacy-empty">
              Escolha ou crie um perfil para consultar, corrigir, exportar e
              excluir seus dados locais. O aviso de privacidade e o contato
              acima estão disponíveis sem criar um perfil.
            </p>
          )}
        </>
      )}
      {error && (
        <p className="privacy-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="privacy-success" role="status">
          {success}
        </p>
      )}
    </Modal>
  );
}
