import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Folder,
  FileText,
  StickyNote,
  MoreHorizontal,
  Sun,
  Moon,
  LogOut,
  Search,
  Upload,
  Download,
  Check,
  HardDrive,
  PenLine,
  Clapperboard,
  BookOpen,
  HelpCircle,
  Trash2,
  Copy,
  Pencil,
  LoaderCircle,
  Settings2,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  PanelLeftClose,
  PanelLeft,
  Save,
  Focus,
  ArrowDown,
} from "lucide-react";
import { Logo, Modal, Field, Help } from "./ui";
import { repository } from "./data/repository";
import { useDocument } from "./data/useDocument";
import {
  makeManuscript,
  id,
  kinds,
  labels,
  textOf,
  characters,
  type Profile,
  type Project,
  type Manuscript,
  type ScriptDoc,
  type Kind,
} from "./model";
import { ScreenplayEditor, type EditorHandle } from "./editor/Editor";
import { geometry, layout } from "./editor/layout";
import { backup, parseBackup, type Backup } from "./io/backup";
import {
  download,
  filename,
  pdfExport,
  docxExport,
  fountainExport,
  fdxExport,
  parseFountain,
  parseFDX,
  parseDOCX,
  parsePDF,
} from "./io/formats";
const date = (n: number) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    n,
  );
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Não foi possível concluir a operação.";
type FormSpec = {
  title: string;
  label: string;
  value?: string;
  description?: string;
  submit: (title: string, description: string) => Promise<void>;
};
type ImportPreview = {
  title: string;
  author: string;
  doc: ScriptDoc;
  warning: string;
};
export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [projects, setProjects] = useState<Project[]>([]),
    [project, setProject] = useState<Project | null>(null),
    [docs, setDocs] = useState<Manuscript[]>([]),
    [active, setActive] = useState<Manuscript | null>(null);
  const [form, setForm] = useState<FormSpec | null>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      body: string;
      run: () => Promise<void>;
    } | null>(null),
    [help, setHelp] = useState(false),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(""),
    [query, setQuery] = useState(""),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [restore, setRestore] = useState<Backup | null>(null),
    [mobile, setMobile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const beforeNavigate = useRef<() => Promise<boolean>>(async () => true);
  const refresh = async (p: Profile) =>
    setProjects(await repository.projects(p.id));
  useEffect(() => {
    (async () => {
      try {
        const all = await repository.profiles();
        setProfiles(all);
        const p = all.find((p) => p.id === localStorage.getItem("ew.profile"));
        if (p) {
          setProfile(p);
          await refresh(p);
        }
      } catch (e) {
        setToast("Erro ao abrir o armazenamento local: " + message(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = profile?.theme || "dark";
  }, [profile?.theme]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 10000);
    return () => clearTimeout(t);
  }, [toast]);
  const safe = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (e) {
      setToast(message(e));
    }
  };
  const enterProfile = async (p: Profile) => {
    setProfile(p);
    localStorage.setItem("ew.profile", p.id);
    setProject(null);
    setActive(null);
    await refresh(p);
  };
  const navigate = async (action: () => Promise<void>) => {
    if (await beforeNavigate.current()) await action();
  };
  const openProject = async (p: Project) => {
    await navigate(async () => {
      const all = await repository.documents(p.id);
      setDocs(all);
      setProject(p);
      setActive(all.find((d) => d.kind === "script") || all[0] || null);
      setMobile(false);
    });
  };
  const selectDoc = async (d: Manuscript) =>
    navigate(async () => {
      const all = await repository.documents(d.projectId);
      const fresh = all.find((n) => n.id === d.id);
      if (fresh) {
        setDocs(all);
        setActive(fresh);
        setMobile(false);
      } else setToast("O documento foi removido em outra aba.");
    });
  const home = () =>
    safe(() =>
      navigate(async () => {
        setActive(null);
        setProject(null);
        beforeNavigate.current = async () => true;
        if (profile) await refresh(profile);
      }),
    );
  const saveList = (doc: Manuscript) =>
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? doc : d)));
  const newProject = () =>
    setForm({
      title: "Novo projeto",
      label: "Título do projeto",
      description: "",
      submit: async (title, description) => {
        const p = await repository.createProject(
          profile!.id,
          title,
          description,
        );
        await refresh(profile!);
        await openProject(p);
      },
    });
  const projectOptions = (p: Project) =>
    setForm({
      title: "Editar projeto",
      label: "Título do projeto",
      value: p.title,
      description: p.description,
      submit: async (title, description) => {
        await repository.renameProject(p, title, description);
        if (project?.id === p.id) setProject({ ...p, title, description });
        await refresh(profile!);
      },
    });
  const deleteProject = (p: Project) =>
    setConfirm({
      title: "Excluir projeto?",
      body: `“${p.title}” e todos os seus roteiros e notas serão excluídos deste navegador. Exporte um backup antes de continuar.`,
      run: async () => {
        if (!(await beforeNavigate.current()))
          throw Error("Salve ou exporte as alterações antes de excluir.");
        await repository.deleteProject(p.id);
        setProject(null);
        setActive(null);
        beforeNavigate.current = async () => true;
        await refresh(profile!);
      },
    });
  const newDoc = (kind: "script" | "note") =>
    setForm({
      title: kind === "script" ? "Novo roteiro" : "Nova nota",
      label: "Título",
      submit: async (title) => {
        if (!(await beforeNavigate.current()))
          throw Error(
            "Resolva o erro de salvamento antes de trocar de documento.",
          );
        const d = makeManuscript(project!.id, title, kind);
        d.author = profile!.name;
        await repository.createDocument(d);
        setDocs(await repository.documents(project!.id));
        setActive(d);
      },
    });
  const renameDoc = (d: Manuscript) =>
    setForm({
      title: "Renomear documento",
      label: "Título",
      value: d.title,
      submit: async (title) => {
        if (!(await beforeNavigate.current()))
          throw Error("Resolva o erro de salvamento antes de renomear.");
        const fresh = (await repository.documents(d.projectId)).find(
          (v) => v.id === d.id,
        );
        if (!fresh) throw Error("Documento removido.");
        const saved = await repository.saveDocument(
          { ...fresh, title },
          fresh.revision,
        );
        setDocs(await repository.documents(d.projectId));
        if (active?.id === d.id) {
          setActive(null);
          setTimeout(() => setActive(saved), 0);
        }
      },
    });
  const duplicateDoc = (d: Manuscript) =>
    safe(async () => {
      if (!(await beforeNavigate.current())) return;
      const fresh = (await repository.documents(d.projectId)).find(
        (v) => v.id === d.id,
      );
      if (!fresh) throw Error("Documento removido.");
      const copy = {
        ...fresh,
        id: id(),
        title: fresh.title + " (cópia)",
        revision: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await repository.createDocument(copy);
      setDocs(await repository.documents(d.projectId));
      setActive(copy);
    });
  const deleteDoc = (d: Manuscript) =>
    setConfirm({
      title: "Excluir documento?",
      body: `O conteúdo de “${d.title}” será excluído. Esta ação não pode ser desfeita.`,
      run: async () => {
        if (!(await beforeNavigate.current()))
          throw Error("Exporte as alterações antes de excluir.");
        await repository.deleteDocument(d.id);
        const all = await repository.documents(d.projectId);
        setDocs(all);
        if (active?.id === d.id) {
          setActive(all[0] || null);
          beforeNavigate.current = async () => true;
        }
      },
    });
  const theme = () =>
    safe(async () => {
      if (!profile) return;
      const next = profile.theme === "dark" ? "light" : "dark";
      await repository.theme(profile.id, next);
      setProfile({ ...profile, theme: next });
    });
  const logout = () =>
    safe(() =>
      navigate(async () => {
        setProfile(null);
        setProject(null);
        setActive(null);
        localStorage.removeItem("ew.profile");
        setProfiles(await repository.profiles());
        beforeNavigate.current = async () => true;
      }),
    );
  const projectBackup = () =>
    safe(async () => {
      if (!project) return;
      if (!(await beforeNavigate.current()))
        throw Error(
          "Não foi possível salvar. Use a exportação do documento para preservar o texto atual.",
        );
      const all = await repository.documents(project.id);
      download(
        new Blob([JSON.stringify(backup(project, all), null, 2)], {
          type: "application/json",
        }),
        filename(project.title) + ".json",
      );
      setToast("Backup do projeto exportado, incluindo roteiros e notas.");
    });
  const importFile = async (file: File) => {
    setBusy("Lendo arquivo…");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "json") {
        setRestore(parseBackup(await file.text()));
        return;
      }
      if (!project) throw Error("Abra um projeto para importar um roteiro.");
      let result: {
        doc: ScriptDoc;
        title?: string;
        author?: string;
        warning?: string;
      };
      switch (ext) {
        case "fountain":
        case "txt":
          result = parseFountain(await file.text());
          break;
        case "fdx":
          result = parseFDX(await file.text());
          break;
        case "docx":
          result = await parseDOCX(file);
          break;
        case "pdf":
          result = await parsePDF(file);
          break;
        default:
          throw Error(
            "Formato não suportado. Use Fountain, FDX, DOCX, PDF ou um backup JSON.",
          );
      }
      if (!result.doc.content.some((b) => textOf(b).trim()))
        throw Error("O arquivo não contém texto para importar.");
      setPreview({
        title: result.title || file.name.replace(/\.[^.]+$/, ""),
        author: result.author || profile!.name,
        doc: result.doc,
        warning:
          result.warning ||
          "Revise o conteúdo. A importação criará um novo roteiro.",
      });
    } catch (e) {
      setToast(message(e));
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const sidebar = (
    <>
      <div className="sidebar-top">
        <Logo />
        <span className="local-pill">
          <span /> Modo local
        </span>
      </div>
      <div className="sidebar-body">
        <button
          className={"nav-item " + (!project ? "active" : "")}
          onClick={home}
        >
          <Folder size={18} />
          Meus projetos<span className="count">{projects.length}</span>
        </button>
        {project && (
          <>
            <button className="back-projects" onClick={home}>
              <ArrowLeft size={13} /> Todos os projetos
            </button>
            <div className="project-heading">
              <small>PROJETO ATUAL</small>
              <div>
                <strong>{project.title}</strong>
                <details className="menu">
                  <summary aria-label="Opções do projeto">
                    <MoreHorizontal size={18} />
                  </summary>
                  <div className="menu-pop">
                    <button onClick={() => projectOptions(project)}>
                      <Pencil size={15} />
                      Editar projeto
                    </button>
                    <button onClick={() => void projectBackup()}>
                      <Download size={15} />
                      Backup do projeto
                    </button>
                    <button
                      className="danger"
                      onClick={() => deleteProject(project)}
                    >
                      <Trash2 size={15} />
                      Excluir projeto
                    </button>
                  </div>
                </details>
              </div>
            </div>
            {(["script", "note"] as const).map((kind) => (
              <section className="doc-section" key={kind}>
                <div className="section-label">
                  <span>{kind === "script" ? "ROTEIROS" : "NOTAS"}</span>
                  <button
                    className="icon-button"
                    aria-label={
                      kind === "script" ? "Novo roteiro" : "Nova nota"
                    }
                    onClick={() => newDoc(kind)}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {docs
                  .filter((d) => d.kind === kind)
                  .map((d) => (
                    <div
                      key={d.id}
                      className={
                        "doc-row " + (active?.id === d.id ? "active" : "")
                      }
                    >
                      <button onClick={() => void safe(() => selectDoc(d))}>
                        {kind === "script" ? (
                          <FileText size={16} />
                        ) : (
                          <StickyNote size={16} />
                        )}
                        <span>{d.title}</span>
                      </button>
                      <details className="menu">
                        <summary aria-label={"Opções de " + d.title}>
                          <MoreHorizontal size={15} />
                        </summary>
                        <div className="menu-pop">
                          <button onClick={() => renameDoc(d)}>
                            <Pencil size={15} />
                            Renomear
                          </button>
                          <button onClick={() => void duplicateDoc(d)}>
                            <Copy size={15} />
                            Duplicar
                          </button>
                          <button
                            className="danger"
                            onClick={() => deleteDoc(d)}
                          >
                            <Trash2 size={15} />
                            Excluir
                          </button>
                        </div>
                      </details>
                    </div>
                  ))}
                {!docs.some((d) => d.kind === kind) && (
                  <p className="empty-small">
                    {kind === "script"
                      ? "Sua próxima história começa aqui."
                      : "Guarde suas ideias aqui."}
                  </p>
                )}
              </section>
            ))}
          </>
        )}
        <div className="sidebar-tip">
          <PenLine size={20} />
          <p>
            Uma ideia de cada vez.
            <br />
            <strong>Uma história só sua.</strong>
          </p>
        </div>
      </div>
      <div className="sidebar-bottom">
        <button className="nav-item" onClick={() => setHelp(true)}>
          <HelpCircle size={17} />
          Ajuda e atalhos
        </button>
        <div className="profile-row">
          <span className="avatar">
            {profile?.name.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{profile?.name}</strong>
            <small>Salvo neste navegador</small>
          </span>
          <button
            className="icon-button"
            aria-label="Sair do perfil"
            title="Trocar perfil"
            onClick={logout}
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </>
  );
  if (loading)
    return (
      <div className="loading">
        <Logo />
        <LoaderCircle className="spin" />
        <p>Abrindo seu espaço…</p>
      </div>
    );
  return (
    <>
      {!profile ? (
        <Login
          profiles={profiles}
          onEnter={(p) => safe(() => enterProfile(p))}
          onCreate={(name, email) =>
            safe(async () => {
              const p = await repository.addProfile(name, email);
              setProfiles(await repository.profiles());
              await enterProfile(p);
            })
          }
        />
      ) : (
        <div className="app-shell">
          <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
            {sidebar}
          </aside>
          {mobile && (
            <button
              className="mobile-overlay"
              aria-label="Fechar navegação"
              onClick={() => setMobile(false)}
            />
          )}
          <main className="main">
            <header className="topbar">
              <div className="breadcrumbs">
                <button
                  className="icon-button mobile-toggle"
                  aria-label="Abrir navegação"
                  onClick={() => setMobile(!mobile)}
                >
                  <PanelLeft size={19} />
                </button>
                <span className="breadcrumb-icon">
                  <BookOpen size={17} />
                </span>
                <button onClick={home}>Meu espaço</button>
                {project && (
                  <>
                    <ChevronRight size={14} />
                    <span>{project.title}</span>
                  </>
                )}
              </div>
              <div className="top-actions">
                <span className="local-status">
                  <span /> Ambiente local
                </span>
                <button
                  className="icon-button"
                  aria-label={
                    profile.theme === "dark"
                      ? "Ativar tema claro"
                      : "Ativar tema escuro"
                  }
                  title="Alternar tema"
                  onClick={theme}
                >
                  {profile.theme === "dark" ? (
                    <Sun size={18} />
                  ) : (
                    <Moon size={18} />
                  )}
                </button>
                <span className="avatar small">
                  {profile.name.slice(0, 1).toUpperCase()}
                </span>
              </div>
            </header>
            {!project ? (
              <div className="dashboard">
                <div className="dashboard-intro">
                  <div>
                    <div className="eyebrow">SEU ESTÚDIO DE ESCRITA</div>
                    <h1>
                      Boas histórias começam
                      <br />
                      com uma <em>primeira linha.</em>
                    </h1>
                    <p>
                      Bem-vindo, {profile.name.split(" ")[0]}. Dê espaço à sua
                      próxima ideia.
                    </p>
                  </div>
                  <div className="intro-mark">
                    <img src="/logo.png" alt="Símbolo Elemental Write" />
                    <span>IMAGINE. ESCREVA. CRIE.</span>
                  </div>
                </div>
                <div className="projects-toolbar">
                  <h2>
                    Meus projetos{" "}
                    <span>{projects.length.toString().padStart(2, "0")}</span>
                  </h2>
                  <div>
                    <label className="search-field">
                      <Search size={16} />
                      <input
                        aria-label="Buscar projetos"
                        placeholder="Buscar projetos…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <button className="primary" onClick={newProject}>
                      <Plus size={17} />
                      Novo projeto
                    </button>
                  </div>
                </div>
                <div className="project-grid">
                  {projects
                    .filter((p) =>
                      (p.title + " " + p.description)
                        .toLocaleLowerCase()
                        .includes(query.toLocaleLowerCase()),
                    )
                    .map((p, i) => (
                      <article className="project-card" key={p.id}>
                        <button
                          className="project-open"
                          onClick={() => void safe(() => openProject(p))}
                        >
                          <div className={"cover cover-" + (i % 4)}>
                            <span className="cover-number">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <Clapperboard size={38} strokeWidth={1} />
                            <span className="cover-label">
                              {p.demo
                                ? "PROJETO DE DEMONSTRAÇÃO"
                                : "PROJETO ORIGINAL"}
                            </span>
                            <ArrowUpRight className="cover-arrow" size={21} />
                          </div>
                          <div className="project-card-content">
                            <h3>{p.title}</h3>
                            <p>
                              {p.description ||
                                "Uma nova história esperando para ser escrita."}
                            </p>
                            <div>
                              <span>
                                <Folder size={13} />{" "}
                                {p.demo ? "Demonstração" : "Projeto"}
                              </span>
                              <time>Atualizado em {date(p.updatedAt)}</time>
                            </div>
                          </div>
                        </button>
                        <details className="menu card-menu">
                          <summary aria-label={"Opções do projeto " + p.title}>
                            <MoreHorizontal size={19} />
                          </summary>
                          <div className="menu-pop">
                            <button onClick={() => projectOptions(p)}>
                              <Pencil size={15} />
                              Editar projeto
                            </button>
                            <button
                              className="danger"
                              onClick={() => deleteProject(p)}
                            >
                              <Trash2 size={15} />
                              Excluir
                            </button>
                          </div>
                        </details>
                      </article>
                    ))}
                  <button className="new-project-card" onClick={newProject}>
                    <span>
                      <Plus size={25} strokeWidth={1.3} />
                    </span>
                    <strong>Uma nova possibilidade</strong>
                    <small>Criar um projeto</small>
                  </button>
                </div>
                {query &&
                  !projects.some((p) =>
                    (p.title + " " + p.description)
                      .toLocaleLowerCase()
                      .includes(query.toLocaleLowerCase()),
                  ) && (
                    <p className="muted">
                      Nenhum projeto encontrado para “{query}”.
                    </p>
                  )}
                <div className="dashboard-footer">
                  <span>
                    <HardDrive size={16} /> Suas histórias ficam neste
                    navegador. Faça backups para mantê-las seguras.
                  </span>
                  <button onClick={() => fileRef.current?.click()}>
                    <Upload size={15} />
                    Restaurar backup
                  </button>
                </div>
              </div>
            ) : active ? (
              <Workspace
                key={active.id}
                initial={active}
                project={project}
                docs={docs}
                onSelect={(d) => void safe(() => selectDoc(d))}
                onSaved={saveList}
                beforeNavigate={beforeNavigate}
                onError={setToast}
                importFile={() => fileRef.current?.click()}
                projectBackup={() => void projectBackup()}
                onHelp={() => setHelp(true)}
              />
            ) : (
              <div className="empty-workspace">
                <span className="empty-icon">
                  <PenLine size={34} />
                </span>
                <div className="eyebrow">
                  UMA PÁGINA EM BRANCO. INFINITAS POSSIBILIDADES.
                </div>
                <h1>{project.title}</h1>
                <p>
                  Crie seu primeiro roteiro ou reúna suas ideias em uma nota.
                </p>
                <div>
                  <button className="primary" onClick={() => newDoc("script")}>
                    <Plus size={18} />
                    Criar roteiro
                  </button>
                  <button className="secondary" onClick={() => newDoc("note")}>
                    <StickyNote size={17} />
                    Criar nota
                  </button>
                  <button
                    className="secondary"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload size={17} />
                    Importar
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      )}
      <input
        type="file"
        className="sr-only"
        ref={fileRef}
        accept={project ? ".fountain,.txt,.fdx,.docx,.pdf,.json" : ".json"}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
        }}
      />
      {form && (
        <NameForm spec={form} close={() => setForm(null)} onError={setToast} />
      )}{" "}
      {confirm && (
        <Confirm
          spec={confirm}
          close={() => setConfirm(null)}
          onError={setToast}
        />
      )}{" "}
      {help && <Help close={() => setHelp(false)} />}
      {preview && (
        <ImportModal
          value={preview}
          close={() => setPreview(null)}
          onImport={async (v) => {
            if (!(await beforeNavigate.current()))
              throw Error("Salve o documento atual antes de importar.");
            const d = {
              ...makeManuscript(project!.id, v.title),
              doc: v.doc,
              author: v.author,
            };
            await repository.createDocument(d);
            setDocs(await repository.documents(project!.id));
            setActive(d);
            setPreview(null);
            setToast("Roteiro importado como um novo documento.");
          }}
        />
      )}
      {restore && (
        <Modal title="Restaurar backup" close={() => setRestore(null)}>
          <div className="notice">
            Será criado um novo projeto no perfil atual. Nenhum conteúdo
            existente será substituído.
          </div>
          <h3>{restore.project.title}</h3>
          <ul className="restore-list">
            {restore.documents.map((d, i) => (
              <li key={i}>
                {d.kind === "script" ? (
                  <FileText size={16} />
                ) : (
                  <StickyNote size={16} />
                )}{" "}
                {d.title}
              </li>
            ))}
          </ul>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setRestore(null)}>
              Cancelar
            </button>
            <button
              className="primary"
              onClick={() =>
                void safe(async () => {
                  if (!(await beforeNavigate.current())) return;
                  const p = await repository.restore(
                    profile!.id,
                    restore.project,
                    restore.documents,
                  );
                  await refresh(profile!);
                  setRestore(null);
                  await openProject(p);
                  setToast("Backup restaurado em um novo projeto.");
                })
              }
            >
              Restaurar projeto
            </button>
          </div>
        </Modal>
      )}
      {busy && (
        <div className="busy-banner" role="status">
          <LoaderCircle className="spin" size={17} />
          {busy}
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button aria-label="Fechar mensagem" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
function Login({
  profiles,
  onEnter,
  onCreate,
}: {
  profiles: Profile[];
  onEnter: (p: Profile) => void;
  onCreate: (name: string, email: string) => void;
}) {
  const [creating, setCreating] = useState(!profiles.length),
    [name, setName] = useState(""),
    [email, setEmail] = useState("");
  return (
    <div className="login">
      <div className="login-story">
        <Logo />
        <span className="edition">SEU ESTÚDIO PESSOAL DE ROTEIROS</span>
        <div className="login-hero">
          <span className="eyebrow">DA PRIMEIRA IDEIA AO ÚLTIMO FADE OUT.</span>
          <h1>
            Toda história
            <br />
            precisa de
            <br />
            <em>um elemento.</em>
          </h1>
          <p>
            O seu é a escrita.
            <br />
            Um espaço tranquilo para imaginar,
            <br />
            organizar e dar vida às suas histórias.
          </p>
        </div>
        <div className="login-foot">
          <span>ELEMENTAL WRITE</span>
          <span>FEITO PARA QUEM CRIA.</span>
        </div>
        <img className="login-watermark" src="/logo.png" alt="" />
      </div>
      <main className="login-form">
        <span className="local-pill">
          <span /> Modo local
        </span>
        <h2>{creating ? "Seu próximo capítulo." : "Bom ter você de volta."}</h2>
        <p>
          {creating
            ? "Crie um perfil para organizar suas histórias."
            : "Escolha seu perfil e continue de onde parou."}
        </p>
        {!creating ? (
          <>
            <div className="profile-list">
              {profiles.map((p) => (
                <button key={p.id} onClick={() => onEnter(p)}>
                  <span className="avatar">
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.email}</small>
                  </span>
                  <ChevronRight size={19} />
                </button>
              ))}
            </div>
            <button
              className="secondary full"
              onClick={() => setCreating(true)}
            >
              <Plus size={17} />
              Criar outro perfil
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onCreate(name.trim(), email.trim());
            }}
          >
            <Field label="Como podemos chamar você?">
              <input
                required
                autoFocus
                name="name"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </Field>
            <Field label="E-mail do perfil">
              <input
                required
                type="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <button
              className="primary full"
              type="submit"
              disabled={!name.trim() || !email.trim()}
            >
              Entrar no meu espaço
              <ArrowUpRight size={18} />
            </button>
            {profiles.length > 0 && (
              <button
                className="text-button full"
                type="button"
                onClick={() => setCreating(false)}
              >
                Voltar aos perfis
              </button>
            )}
          </form>
        )}
        <div className="login-local-info">
          <HardDrive size={18} />
          <p>
            Sem senha. Sem conta externa.
            <br />
            Os dados ficam somente neste navegador. Perfis locais não oferecem
            autenticação segura.
          </p>
        </div>
      </main>
    </div>
  );
}
function NameForm({
  spec,
  close,
  onError,
}: {
  spec: FormSpec;
  close: () => void;
  onError: (m: string) => void;
}) {
  const [value, setValue] = useState(spec.value || ""),
    [description, setDescription] = useState(spec.description || ""),
    [pending, setPending] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setPending(true);
    try {
      await spec.submit(value.trim(), description.trim());
      close();
    } catch (e) {
      onError(message(e));
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal title={spec.title} close={close}>
      <form onSubmit={submit}>
        <Field label={spec.label}>
          <input
            autoFocus
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        {spec.description !== undefined && (
          <Field label="Descrição (opcional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </Field>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={pending || !value.trim()}>
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Confirm({
  spec,
  close,
  onError,
}: {
  spec: { title: string; body: string; run: () => Promise<void> };
  close: () => void;
  onError: (m: string) => void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Modal title={spec.title} close={close}>
      <p>{spec.body}</p>
      <div className="modal-actions">
        <button className="secondary" autoFocus onClick={close}>
          Cancelar
        </button>
        <button
          className="danger-button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              await spec.run();
              close();
            } catch (e) {
              onError(message(e));
            } finally {
              setPending(false);
            }
          }}
        >
          Excluir
        </button>
      </div>
    </Modal>
  );
}
function Workspace({
  initial,
  project,
  docs,
  onSelect,
  onSaved,
  beforeNavigate,
  onError,
  importFile,
  projectBackup,
  onHelp,
}: {
  initial: Manuscript;
  project: Project;
  docs: Manuscript[];
  onSelect: (d: Manuscript) => void;
  onSaved: (d: Manuscript) => void;
  beforeNavigate: React.MutableRefObject<() => Promise<boolean>>;
  onError: (m: string) => void;
  importFile: () => void;
  projectBackup: () => void;
  onHelp: () => void;
}) {
  const { value, change, flush, status, error, latest } = useDocument(
    initial,
    onSaved,
  );
  const editor = useRef<EditorHandle>(null);
  const [kind, setKind] = useState<Kind>(initial.doc.content[0].attrs.kind),
    [pages, setPages] = useState(1),
    [zoom, setZoom] = useState(85),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [results, setResults] = useState(0),
    [settings, setSettings] = useState(false),
    [outline, setOutline] = useState(true),
    [focus, setFocus] = useState(false),
    [exporting, setExporting] = useState("");
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    beforeNavigate.current = () => flushRef.current();
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flushRef.current();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      beforeNavigate.current = async () => true;
      window.removeEventListener("keydown", key);
    };
  }, []);
  useEffect(() => {
    if (search) setResults(editor.current?.search(query) || 0);
  }, [query, value.doc, search]);
  const exportFile = async (format: string) => {
    setExporting(format);
    try {
      await flush();
      const d = latest.current;
      const name = filename(d.title);
      if (format === "pdf") download(await pdfExport(d), name + ".pdf");
      if (format === "docx") download(await docxExport(d), name + ".docx");
      if (format === "fountain")
        download(
          new Blob([fountainExport(d)], { type: "text/plain;charset=utf-8" }),
          name + ".fountain",
        );
      if (format === "fdx")
        download(
          new Blob([fdxExport(d)], { type: "application/xml;charset=utf-8" }),
          name + ".fdx",
        );
      if (format === "json")
        download(
          new Blob([JSON.stringify(backup(project, [d]), null, 2)], {
            type: "application/json",
          }),
          name + ".json",
        );
      if (format === "txt")
        download(
          new Blob([d.body], { type: "text/plain;charset=utf-8" }),
          name + ".txt",
        );
    } catch (e) {
      onError(message(e));
    } finally {
      setExporting("");
    }
  };
  const scenes = value.doc.content.filter((b) => b.attrs.kind === "scene");
  const words = (
    value.kind === "note" ? value.body : value.doc.content.map(textOf).join(" ")
  )
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const g = geometry(value.paper);
  return (
    <div className={"workspace " + (focus ? "focus-mode" : "")}>
      <div className="document-tabs">
        {docs.map((d) => (
          <button
            key={d.id}
            className={d.id === value.id ? "selected" : ""}
            onClick={() => onSelect(d)}
          >
            {d.kind === "script" ? (
              <FileText size={14} />
            ) : (
              <StickyNote size={14} />
            )}
            <span>{d.title}</span>
            {d.id === value.id && <span className="tab-dot" />}
          </button>
        ))}
      </div>
      <div className="document-heading">
        <div>
          <div className="eyebrow">
            {value.kind === "script" ? "ROTEIRO" : "CADERNO DE IDEIAS"}
            {project.demo && <span className="demo-badge">DEMONSTRAÇÃO</span>}
          </div>
          <h1>{value.title}</h1>
          <div
            className={"save-state " + (error ? "error" : "")}
            aria-live="polite"
          >
            {status === "Salvo neste navegador" ? (
              <Check size={13} />
            ) : status === "Salvando…" ? (
              <LoaderCircle size={13} className="spin" />
            ) : (
              <span className="unsaved-dot" />
            )}
            {status}
          </div>
        </div>
        <div className="document-actions">
          <button
            className="icon-button"
            aria-label="Configurar página e folha de rosto"
            title="Página e folha de rosto"
            onClick={() => setSettings(true)}
          >
            <Settings2 size={18} />
          </button>
          <button className="secondary" onClick={importFile}>
            <Upload size={16} />
            <span>Importar</span>
          </button>
          <details className="menu export-menu">
            <summary className="primary">
              {exporting ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Download size={16} />
              )}
              Exportar
              <ChevronDown size={14} />
            </summary>
            <div className="menu-pop">
              <small>ESTE DOCUMENTO</small>
              {(value.kind === "script"
                ? ["pdf", "docx", "fountain", "fdx", "json"]
                : ["txt", "json"]
              ).map((f) => (
                <button
                  key={f}
                  disabled={!!exporting}
                  onClick={(e) => {
                    e.currentTarget.closest("details")?.removeAttribute("open");
                    void exportFile(f);
                  }}
                >
                  <FileText size={15} />
                  {f === "json"
                    ? "Backup do documento (.json)"
                    : f.toUpperCase()}
                </button>
              ))}
              <hr />
              <button
                onClick={(e) => {
                  e.currentTarget.closest("details")?.removeAttribute("open");
                  projectBackup();
                }}
              >
                <Folder size={15} />
                Backup do projeto inteiro
              </button>
            </div>
          </details>
        </div>
      </div>
      {error && (
        <div className="save-error" role="alert">
          {error} <button onClick={() => void flush()}>Tentar salvar</button>
          <button onClick={() => void exportFile("json")}>
            Exportar texto atual
          </button>
        </div>
      )}
      <div className="editor-toolbar">
        {value.kind === "script" ? (
          <>
            <button
              className="icon-button"
              aria-label="Mostrar cenas"
              title="Navegação pelas cenas"
              onClick={() => setOutline(!outline)}
            >
              {outline ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </button>
            <span className="toolbar-divider" />
            <select
              aria-label="Tipo do bloco"
              value={kind}
              onChange={(e) => editor.current?.kind(e.target.value as Kind)}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {labels[k]}
                </option>
              ))}
            </select>
            <span className="key-hint">Tab</span>
            <span className="toolbar-divider" />
            {(
              [
                ["undo", "Desfazer", <Undo2 size={17} />],
                ["redo", "Refazer", <Redo2 size={17} />],
                ["bold", "Negrito", <Bold size={17} />],
                ["italic", "Itálico", <Italic size={17} />],
                ["underline", "Sublinhado", <Underline size={17} />],
              ] as [string, string, ReactNode][]
            ).map(([cmd, label, icon]) => (
              <button
                key={cmd}
                className="icon-button"
                aria-label={label}
                title={label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.current?.command(cmd)}
              >
                {icon}
              </button>
            ))}
            <span className="toolbar-divider" />
            <button
              className={"icon-button " + (search ? "is-active" : "")}
              aria-label="Buscar no roteiro"
              title="Buscar no roteiro"
              onClick={() => {
                if (search) editor.current?.search("");
                setSearch(!search);
              }}
            >
              <Search size={17} />
            </button>
          </>
        ) : (
          <span className="note-toolbar-label">
            <StickyNote size={17} /> Um lugar para suas ideias
          </span>
        )}
        <div className="toolbar-right">
          <button
            className="icon-button"
            aria-label="Salvar agora"
            title="Salvar (Ctrl/⌘+S)"
            onClick={() => void flush()}
          >
            <Save size={17} />
          </button>
          {value.kind === "script" && (
            <>
              <select
                aria-label="Zoom da página"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              >
                {[60, 70, 85, 100, 110, 125].map((z) => (
                  <option key={z} value={z}>
                    {z}%
                  </option>
                ))}
              </select>
              <button
                className={"icon-button " + (focus ? "is-active" : "")}
                aria-label="Alternar modo foco"
                title="Modo foco"
                onClick={() => setFocus(!focus)}
              >
                <Focus size={18} />
              </button>
            </>
          )}
        </div>
      </div>
      {search && (
        <div className="search-bar">
          <Search size={16} />
          <input
            aria-label="Texto para buscar"
            autoFocus
            placeholder="Buscar neste roteiro…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") editor.current?.nextMatch();
            }}
          />
          <span>
            {results} {results === 1 ? "ocorrência" : "ocorrências"}
          </span>
          <button
            className="icon-button"
            aria-label="Próxima ocorrência"
            onClick={() => editor.current?.nextMatch()}
          >
            <ArrowDown size={16} />
          </button>
        </div>
      )}
      <div className="writing-area">
        {outline && value.kind === "script" && !focus && (
          <aside className="outline">
            <div className="section-label">
              <span>CENAS</span>
              <span className="count">
                {scenes.length.toString().padStart(2, "0")}
              </span>
            </div>
            <div className="outline-list">
              {scenes.map((b, i) => (
                <button key={i} onClick={() => editor.current?.scene(i)}>
                  <span>{(i + 1).toString().padStart(2, "0")}</span>
                  <div>
                    <strong>{textOf(b) || "Nova cena"}</strong>
                    <small>
                      {/EXT\./i.test(textOf(b))
                        ? "EXTERIOR"
                        : /INT\./i.test(textOf(b))
                          ? "INTERIOR"
                          : "CENA"}
                    </small>
                  </div>
                </button>
              ))}
              {!scenes.length && (
                <p className="empty-small">
                  Use um cabeçalho para começar uma cena.
                </p>
              )}
            </div>
            <div className="outline-bottom">
              <small>PERSONAGENS</small>
              {characters(value.doc).map((n) => (
                <span key={n}>
                  <span className="character-dot" />
                  {n}
                </span>
              ))}
              {!characters(value.doc).length && (
                <p className="empty-small">Os personagens aparecerão aqui.</p>
              )}
            </div>
          </aside>
        )}
        <div className="page-scroll">
          {value.kind === "script" ? (
            <div
              className="paper-stage"
              style={{
                width: (((g.width * 4) / 3) * zoom) / 100,
                minHeight: (((g.height * 4) / 3) * zoom) / 100,
              }}
            >
              <div
                className={"paper " + value.paper}
                style={{
                  width: (g.width * 4) / 3,
                  minHeight: (g.height * 4) / 3,
                  zoom: zoom / 100,
                }}
              >
                <div className="paper-running">
                  <span>{value.title}</span>
                  <span>1.</span>
                </div>
                <ScreenplayEditor
                  ref={editor}
                  doc={initial.doc}
                  paper={value.paper}
                  onChange={(doc) => change({ doc })}
                  onKind={setKind}
                  onPages={setPages}
                />
                <div className="paper-end">
                  {Array.from({ length: 3 }, (_, i) => (
                    <span key={i} />
                  ))}
                  <span>CONTINUE SUA HISTÓRIA</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="note-paper">
              <span className="eyebrow">NOTAS DO PROJETO</span>
              <h2>{value.title}</h2>
              <textarea
                aria-label="Corpo da nota"
                lang="pt-BR"
                spellCheck
                placeholder="Uma ideia, uma referência, uma possibilidade…"
                value={value.body}
                onChange={(e) => change({ body: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>
      <footer className="editor-status">
        <span>
          <span className="status-dot" />
          {value.kind === "script" ? "Roteiro" : "Nota"}
          <i />
          Português (Brasil)
        </span>
        <div>
          <span>{words.toLocaleString("pt-BR")} palavras</span>
          {value.kind === "script" && (
            <>
              <i />
              <span>
                {pages} {pages === 1 ? "página" : "páginas"}
              </span>
              <i />
              <span>{value.paper === "letter" ? "Carta" : "A4"}</span>
            </>
          )}
          <button aria-label="Ajuda com atalhos" onClick={onHelp}>
            <HelpCircle size={14} />
            <span>Atalhos</span>
          </button>
        </div>
      </footer>
      {settings && (
        <Modal title="Página e folha de rosto" close={() => setSettings(false)}>
          <Field label="Título do documento">
            <input
              value={value.title}
              onChange={(e) => change({ title: e.target.value })}
            />
          </Field>
          <Field label="Autor">
            <input
              value={value.author}
              onChange={(e) => change({ author: e.target.value })}
            />
          </Field>
          {value.kind === "script" && (
            <>
              <Field label="Tamanho da página">
                <select
                  value={value.paper}
                  onChange={(e) =>
                    change({ paper: e.target.value as "letter" | "a4" })
                  }
                >
                  <option value="letter">Carta — 21,59 × 27,94 cm</option>
                  <option value="a4">A4 — 21 × 29,7 cm</option>
                </select>
              </Field>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={value.titlePage}
                  onChange={(e) => change({ titlePage: e.target.checked })}
                />
                Incluir folha de rosto no PDF e DOCX
              </label>
              <p className="muted">
                Fonte monoespaçada de 12 pontos. Margens: 3,81 cm à esquerda;
                2,54 cm nas demais bordas. O Word pode repaginar o documento.
              </p>
            </>
          )}
          <div className="modal-actions">
            <button
              className="primary"
              onClick={async () => {
                if (await flush()) setSettings(false);
              }}
            >
              Salvar configurações
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ImportModal({
  value,
  close,
  onImport,
}: {
  value: ImportPreview;
  close: () => void;
  onImport: (v: ImportPreview) => Promise<void>;
}) {
  const [v, setV] = useState(value),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title="Revisar importação" close={close} wide>
      <div className="notice">{v.warning}</div>
      <div className="import-fields">
        <Field label="Título do novo roteiro">
          <input
            value={v.title}
            onChange={(e) => setV({ ...v, title: e.target.value })}
          />
        </Field>
        <Field label="Autor">
          <input
            value={v.author}
            onChange={(e) => setV({ ...v, author: e.target.value })}
          />
        </Field>
      </div>
      <div className="import-preview">
        {v.doc.content.map((b, i) => (
          <div key={i}>
            <span className="muted">{i + 1}</span>
            <select
              aria-label={"Tipo do bloco importado " + (i + 1)}
              value={b.attrs.kind}
              onChange={(e) =>
                setV({
                  ...v,
                  doc: {
                    ...v.doc,
                    content: v.doc.content.map((node, n) =>
                      n === i
                        ? { ...node, attrs: { kind: e.target.value as Kind } }
                        : node,
                    ),
                  },
                })
              }
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {labels[k]}
                </option>
              ))}
            </select>
            <p>{textOf(b) || "Bloco vazio"}</p>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <span className="muted">
          {v.doc.content.length} blocos · novo documento
        </span>
        <button className="secondary" onClick={close}>
          Cancelar
        </button>
        <button
          className="primary"
          disabled={busy || !v.title.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await onImport(v);
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Importando…" : "Importar roteiro"}
        </button>
      </div>
    </Modal>
  );
}
