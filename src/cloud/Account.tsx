import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import App from "../App";
import { Logo } from "../ui";
import { ArrowRight, Cloud, HardDrive } from "lucide-react";
import { localRepository, selectRepository } from "../data/repository";
import { CloudRepository } from "./repository";
import { supabase, checked, redirectURL } from "./client";
import { PrivacyLinks } from "../privacy/PrivacyNotice";

export function Account() {
  const [ready, setReady] = useState(!supabase),
    [session, setSession] = useState<Session | null>(null);
  const [local, setLocal] = useState(!supabase),
    [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState("");
  const [mode, setMode] = useState("login"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!supabase) return;
    const callbackError =
      new URLSearchParams(window.location.search).get("error_description") ||
      new URLSearchParams(window.location.hash.slice(1)).get(
        "error_description",
      );
    if (callbackError)
      setMessage("O link não pôde ser usado. Solicite um novo e-mail.");
    supabase.auth.getSession().then((r) => {
      if (r.error) setMessage(r.error.message);
      setSession(r.data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, value) => {
      setSession(value);
      setReady(true);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") {
        selectRepository(localRepository);
        setLocal(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }
  const [active, setActive] = useState<string>("");
  useEffect(() => {
    if (!ready || recovery) return;
    if (local) {
      selectRepository(localRepository);
      setActive("local");
      return;
    }
    if (!session || !supabase) {
      setActive("");
      return;
    }
    setActive("");
    let alive = true;
    const repo = new CloudRepository(supabase, session.user);
    repo
      .profiles()
      .then(() => {
        if (alive) {
          selectRepository(repo, true, session.user.id);
          localStorage.setItem("ew.profile", session.user.id);
          setActive(session.user.id);
        }
      })
      .catch((e) => setMessage(e.message));
    return () => {
      alive = false;
    };
  }, [ready, local, session?.user.id, recovery]);
  async function transfer() {
    const profiles = await localRepository.profiles();
    const target = new CloudRepository(supabase!, session!.user);
    if (
      !window.confirm(
        `Copiar os projetos de ${profiles.length} perfis locais para esta conta? A cópia local será preservada. Novas tentativas criam novas cópias.`,
      )
    )
      return;
    let count = 0;
    for (const profile of profiles) {
      const snapshot = await localRepository.exportProfile(profile.id);
      for (const item of snapshot.projects) {
        await target.restore(session!.user.id, item.project, item.documents);
        count++;
        setMessage(
          `${count} projetos transferidos. Cópias locais preservadas.`,
        );
      }
    }
    window.dispatchEvent(new Event("ew-cloud-imported"));
    setMessage(`${count} projetos transferidos. Cópias locais preservadas.`);
  }
  if (!ready) return <p role="status">Abrindo sessão…</p>;
  if (active && !recovery)
    return (
      <>
        <div className="cloud-account-bar">
          <span>{local ? "Modo local" : `Nuvem · ${session?.user.email}`}</span>
          {session && !local && (
            <button
              disabled={busy}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("ew-account-navigate", {
                    detail: () => void run(transfer),
                  }),
                )
              }
            >
              Transferir projetos locais para a conta
            </button>
          )}
          {local && supabase && (
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("ew-account-navigate", {
                    detail: () => {
                      setLocal(false);
                      setActive("");
                    },
                  }),
                )
              }
            >
              Entrar na nuvem
            </button>
          )}
          {message && <span role="status">{message}</span>}
        </div>
        <App key={active} />
      </>
    );
  return (
    <div className="login account-entry">
      <aside className="login-story">
        <Logo />
        <div className="login-hero">
          <span className="eyebrow">SEU ESTÚDIO PESSOAL DE ROTEIROS</span>
          <h1>
            Toda história
            <br />
            começa com
            <br />
            <em>uma ideia.</em>
          </h1>
          <p>
            Um espaço para encontrar sua voz.
            <br />
            Escreva, organize e leve suas histórias
            <br />
            para onde a inspiração chegar.
          </p>
        </div>
        <div className="login-foot">
          <span>ELEMENTAL WRITE</span>
          <span>FEITO PARA QUEM CRIA.</span>
        </div>
      </aside>
      <main className="cloud-login">
        <span className="account-eyebrow">
          <Cloud size={15} aria-hidden="true" /> SEU ESPAÇO, EM QUALQUER LUGAR
        </span>
        <h2>
          {recovery
            ? "Definir nova senha"
            : mode === "signup"
              ? "Criar conta"
              : mode === "reset"
                ? "Recuperar senha"
                : "Entrar na nuvem"}
        </h2>
        <p className="account-intro">
          {recovery
            ? "Escolha uma nova senha para voltar às suas histórias."
            : mode === "signup"
              ? "Dê às suas ideias um lugar para crescer."
              : mode === "reset"
                ? "Enviaremos um link para você recuperar o acesso."
                : "Bom ter você de volta. Sua próxima página espera por você."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (recovery) {
                checked(await supabase!.auth.updateUser({ password }));
                setRecovery(false);
                setMessage("Senha atualizada.");
                return;
              }
              if (mode === "signup") {
                checked(
                  await supabase!.auth.signUp({
                    email,
                    password,
                    options: { emailRedirectTo: redirectURL(), data: { name } },
                  }),
                );
                setMessage("Confira seu e-mail para confirmar o cadastro.");
              } else if (mode === "reset") {
                checked(
                  await supabase!.auth.resetPasswordForEmail(email, {
                    redirectTo: redirectURL(),
                  }),
                );
                setMessage(
                  "Se houver uma conta, você receberá um link de recuperação.",
                );
              } else {
                checked(
                  await supabase!.auth.signInWithPassword({ email, password }),
                );
                setLocal(false);
              }
            });
          }}
        >
          {mode === "signup" && !recovery && (
            <label>
              Nome ou apelido
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          {!recovery && (
            <label>
              E-mail
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {(mode !== "reset" || recovery) && (
            <label>
              Senha
              <input
                required
                type="password"
                minLength={8}
                autoComplete={
                  mode === "signup" || recovery
                    ? "new-password"
                    : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          <button className="primary" disabled={busy || !supabase}>
            {busy ? "Aguarde…" : "Continuar"}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </form>
        {!recovery && (
          <div className="account-options">
            <button
              className="account-switch"
              onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            >
              {mode === "signup" ? "Já tenho conta" : "Cadastrar"}
            </button>
            <button
              className="account-forgot"
              onClick={() => setMode(mode === "reset" ? "login" : "reset")}
            >
              {mode === "reset" ? "Voltar ao login" : "Esqueci minha senha"}
            </button>
            <div className="account-divider">
              <span>ou continue no seu dispositivo</span>
            </div>
            <button
              className="account-local"
              onClick={() => {
                setLocal(true);
                setMessage("");
              }}
            >
              <HardDrive size={16} aria-hidden="true" />
              Continuar com dados locais
            </button>
          </div>
        )}
        {message && (
          <p className="account-message" role="status">
            {message}
          </p>
        )}
        <p className="account-privacy">
          Seus projetos acompanham sua conta na nuvem. Dados locais só são
          transferidos quando você escolher.
        </p>
        <PrivacyLinks />
      </main>
    </div>
  );
}
