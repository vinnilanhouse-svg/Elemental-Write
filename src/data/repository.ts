import Dexie, { type Table } from "dexie";
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
  addProfile(name: string, email: string): Promise<Profile>;
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
  async addProfile(name: string, email: string) {
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
    await this.folders.add(p);
    return p;
  }
  async renameProject(project: Project, title: string, description: string) {
    await this.folders.update(project.id, {
      title,
      description,
      updatedAt: Date.now(),
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
    await this.transaction("rw", this.folders, this.manuscripts, async () => {
      await this.folders.add(p);
      await this.manuscripts.bulkAdd(
        docs.map((d) => ({ ...d, id: id(), projectId: p.id, revision: 0 })),
      );
    });
    return p;
  }
}
export const repository: Repository = new LocalRepository();
