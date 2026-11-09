import Dexie, { type Table } from "dexie";
import type { CoverTemplate } from "../cover/model";
import { isProjectIconId, type ProjectIconId } from "../projects/icons";
import type { ProfileSnapshot } from "../privacy/archive";
import {
  block,
  id,
  makeManuscript,
  type Profile,
  type Project,
  type Manuscript,
} from "../model";
export class ConflictError extends Error {
  constructor() {
    super(
      "Este documento foi alterado em outra aba. Seu texto foi preservado aqui. Exporte uma cópia antes de recarregar.",
    );
  }
}
export interface Repository {
  profiles(): Promise<Profile[]>;
  addProfile(name: string, email?: string): Promise<Profile>;
  updateProfile(
    profileId: string,
    name: string,
    email: string,
  ): Promise<Profile>;
  exportProfile(profileId: string): Promise<ProfileSnapshot>;
  deleteProfile(profileId: string): Promise<void>;
  theme(profileId: string, theme: Profile["theme"]): Promise<void>;
  projects(profileId: string): Promise<Project[]>;
  createProject(
    profileId: string,
    title: string,
    description?: string,
  ): Promise<Project>;
  renameProject(
    project: Project,
    title: string,
    description: string,
  ): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
  saveProjectIcon(projectId: string, icon: ProjectIconId): Promise<Project>;
  saveProjectCover(
    projectId: string,
    cover: CoverTemplate,
    expected?: CoverTemplate,
  ): Promise<Project>;
  documents(projectId: string): Promise<Manuscript[]>;
  createDocument(doc: Manuscript): Promise<void>;
  saveDocument(doc: Manuscript, expectedRevision: number): Promise<Manuscript>;
  deleteDocument(id: string): Promise<void>;
  restore(
    profileId: string,
    project: Project,
    docs: Manuscript[],
  ): Promise<Project>;
}
export class LocalRepository extends Dexie implements Repository {
  people!: Table<Profile, string>;
  folders!: Table<Project, string>;
  manuscripts!: Table<Manuscript, string>;
  constructor(name = "elemental-write") {
    super(name);
    this.version(1).stores({
      people: "id,email",
      folders: "id,profileId",
      manuscripts: "id,projectId",
    });
  }
  async profiles() {
    return this.people.toArray();
  }
  async addProfile(name: string, email = "") {
    const p: Profile = {
      id: id(),
      name,
      email,
      theme: "dark",
      createdAt: Date.now(),
    };
    await this.transaction(
      "rw",
      this.people,
      this.folders,
      this.manuscripts,
      async () => {
        await this.people.add(p);
        const project: Project = {
          id: id(),
          profileId: p.id,
          title: "Além do horizonte",
          description: "Um pequeno começo para uma grande história.",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          demo: true,
        };
        await this.folders.add(project);
        const script = makeManuscript(project.id, "Além do horizonte");
        script.author = name;
        script.doc = {
          type: "doc",
          content: [
            block("scene", "EXT. FAROL — FIM DE TARDE"),
            block(
              "action",
              "O mar encontra as pedras. Ao longe, um farol acende pela primeira vez em anos.",
            ),
            block(
              "action",
              "LIA, 28, observa o horizonte. Em sua mão, uma carta que nunca chegou ao destino.",
            ),
            block("character", "LIA"),
            block("dialogue", "Você acha que ele ainda está esperando?"),
            block("character", "TOMÁS"),
            block("parenthetical", "(olhando para o mar)"),
            block("dialogue", "Algumas luzes não se apagam."),
            block("scene", "INT. FAROL — NOITE"),
            block(
              "action",
              "A escada de ferro range. Lia sobe, seguindo a luz.",
            ),
            block("character", "LIA"),
            block("dialogue", "Então é melhor a gente continuar."),
            block("transition", "FADE OUT."),
          ],
        };
        const note = makeManuscript(project.id, "Ideias e referências", "note");
        note.body =
          "O farol é um lugar de reencontros.\n\nLia procura respostas; Tomás aprendeu a esperar.\n\nExplorar o contraste entre a imensidão do mar e o silêncio do farol.";
        await this.manuscripts.bulkAdd([script, note]);
      },
    );
    return p;
  }
  async updateProfile(profileId: string, name: string, email: string) {
    if (!name.trim() || name.trim().length > 120 || email.trim().length > 254)
      throw Error("Confira o nome e o e-mail do perfil.");
    return this.transaction("rw", this.people, async () => {
      const current = await this.people.get(profileId);
      if (!current) throw Error("Este perfil foi removido.");
      const saved = { ...current, name: name.trim(), email: email.trim() };
      await this.people.put(saved);
      return saved;
    });
  }
  async exportProfile(profileId: string): Promise<ProfileSnapshot> {
    return this.transaction(
      "r",
      this.people,
      this.folders,
      this.manuscripts,
      async () => {
        const profile = await this.people.get(profileId);
        if (!profile) throw Error("Este perfil foi removido.");
        const projects = await this.folders
          .where("profileId")
          .equals(profileId)
          .toArray();
        const documents = projects.length
          ? await this.manuscripts
              .where("projectId")
              .anyOf(projects.map((p) => p.id))
              .toArray()
          : [];
        return {
          profile,
          projects: projects.map((project) => ({
            project,
            documents: documents.filter((d) => d.projectId === project.id),
          })),
        };
      },
    );
  }
  async deleteProfile(profileId: string) {
    await this.transaction(
      "rw",
      this.people,
      this.folders,
      this.manuscripts,
      async () => {
        const projects = await this.folders
          .where("profileId")
          .equals(profileId)
          .primaryKeys();
        if (projects.length) {
          await this.manuscripts.where("projectId").anyOf(projects).delete();
          await this.folders.bulkDelete(projects);
        }
        await this.people.delete(profileId);
      },
    );
  }
  async theme(profileId: string, theme: Profile["theme"]) {
    await this.people.update(profileId, { theme });
  }
  async projects(profileId: string) {
    return (
      await this.folders.where("profileId").equals(profileId).toArray()
    ).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async createProject(profileId: string, title: string, description = "") {
    const p: Project = {
      id: id(),
      profileId,
      title,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.transaction("rw", this.people, this.folders, async () => {
      if (!(await this.people.get(profileId)))
        throw Error(
          "Este perfil foi removido. Escolha um perfil para continuar.",
        );
      await this.folders.add(p);
    });
    return p;
  }
  async renameProject(project: Project, title: string, description: string) {
    await this.folders.update(project.id, {
      title,
      description,
      updatedAt: Date.now(),
    });
  }
  async saveProjectIcon(projectId: string, icon: ProjectIconId) {
    if (!isProjectIconId(icon)) throw Error("Escolha um ícone válido.");
    return this.transaction("rw", this.folders, async () => {
      const current = await this.folders.get(projectId);
      if (!current) throw Error("O projeto foi removido.");
      if ((current.icon || "clapperboard") === icon) return current;
      const saved = { ...current, icon, updatedAt: Date.now() };
      await this.folders.put(saved);
      return saved;
    });
  }
  async saveProjectCover(
    projectId: string,
    cover: CoverTemplate,
    expected?: CoverTemplate,
  ) {
    return this.transaction("rw", this.folders, async () => {
      const current = await this.folders.get(projectId);
      if (!current) throw Error("O projeto foi removido.");
      if (
        JSON.stringify(current.cover ?? null) !==
        JSON.stringify(expected ?? null)
      )
        throw Error(
          "A capa foi alterada em outra aba. Feche e abra o editor para carregar a versão mais recente.",
        );
      const saved = { ...current, cover, updatedAt: Date.now() };
      await this.folders.put(saved);
      return saved;
    });
  }
  async deleteProject(projectId: string) {
    await this.transaction("rw", this.folders, this.manuscripts, async () => {
      await this.manuscripts.where("projectId").equals(projectId).delete();
      await this.folders.delete(projectId);
    });
  }
  async documents(projectId: string) {
    return this.manuscripts
      .where("projectId")
      .equals(projectId)
      .sortBy("createdAt");
  }
  async createDocument(doc: Manuscript) {
    await this.transaction("rw", this.manuscripts, this.folders, async () => {
      if (!(await this.folders.get(doc.projectId)))
        throw Error("O projeto foi removido.");
      await this.manuscripts.add(doc);
      await this.folders.update(doc.projectId, { updatedAt: Date.now() });
    });
  }
  async saveDocument(doc: Manuscript, expectedRevision: number) {
    return this.transaction("rw", this.manuscripts, this.folders, async () => {
      const current = await this.manuscripts.get(doc.id);
      if (!current || current.revision !== expectedRevision)
        throw new ConflictError();
      const saved = {
        ...doc,
        revision: expectedRevision + 1,
        updatedAt: Date.now(),
      };
      await this.manuscripts.put(saved);
      await this.folders.update(doc.projectId, { updatedAt: saved.updatedAt });
      return saved;
    });
  }
  async deleteDocument(docId: string) {
    await this.manuscripts.delete(docId);
  }
  async restore(profileId: string, project: Project, docs: Manuscript[]) {
    const p = {
      ...project,
      id: id(),
      profileId,
      title: project.title + " (restaurado)",
      demo: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.transaction(
      "rw",
      this.people,
      this.folders,
      this.manuscripts,
      async () => {
        if (!(await this.people.get(profileId)))
          throw Error(
            "Este perfil foi removido. Escolha um perfil para continuar.",
          );
        await this.folders.add(p);
        await this.manuscripts.bulkAdd(
          docs.map((d) => ({ ...d, id: id(), projectId: p.id, revision: 0 })),
        );
      },
    );
    return p;
  }
}
export const repository: Repository = new LocalRepository();
