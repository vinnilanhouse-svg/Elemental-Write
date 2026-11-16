import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ConflictError, type Repository } from "../data/repository";
import { id, type Profile, type Project, type Manuscript } from "../model";
import type { CoverTemplate } from "../cover/model";
import { isProjectIconId, type ProjectIconId } from "../projects/icons";
import { checked } from "./client";

export class CloudRepository implements Repository {
  constructor(
    readonly client: SupabaseClient,
    readonly user: User,
  ) {}
  private async rpc<T>(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    return checked(await this.client.rpc(name, args)) as T;
  }
  async profiles(): Promise<Profile[]> {
    const rows = checked(
      await this.client
        .from("ew_profiles")
        .select("data")
        .eq("owner_id", this.user.id),
    );
    if (rows.length)
      return rows.map((r) => ({ ...r.data, email: this.user.email || "" }));
    const profile: Profile = {
      id: this.user.id,
      name:
        this.user.user_metadata.name ||
        this.user.email?.split("@")[0] ||
        "Autor",
      email: this.user.email || "",
      theme: "dark",
      createdAt: Date.parse(this.user.created_at),
    };
    checked(
      await this.client
        .from("ew_profiles")
        .upsert(
          { owner_id: this.user.id, data: profile },
          { onConflict: "owner_id", ignoreDuplicates: true },
        ),
    );
    return [profile];
  }
  async addProfile(): Promise<Profile> {
    throw Error("Use o cadastro de conta.");
  }
  async updateProfile(profileId: string, name: string, email: string) {
    if (profileId !== this.user.id || !name.trim() || name.length > 120)
      throw Error("Confira o nome.");
    if (email !== this.user.email)
      checked(
        await this.client.auth.updateUser(
          { email },
          { emailRedirectTo: window.location.origin + "/" },
        ),
      );
    const p = { ...(await this.profiles())[0], name: name.trim() };
    checked(
      await this.client
        .from("ew_profiles")
        .update({ data: p })
        .eq("owner_id", this.user.id),
    );
    return p;
  }
  async theme(_profileId: string, theme: Profile["theme"]) {
    const p = { ...(await this.profiles())[0], theme };
    checked(
      await this.client
        .from("ew_profiles")
        .update({ data: p })
        .eq("owner_id", this.user.id),
    );
  }
  async exportProfile(_profileId: string) {
    return this.rpc<import("../privacy/archive").ProfileSnapshot>("ew_export");
  }
  async deleteProfile(_profileId: string, password?: string) {
    if (!password) throw Error("Confirme sua senha para excluir a conta.");
    checked(
      await this.client.auth.signInWithPassword({
        email: this.user.email!,
        password,
      }),
    );
    checked(
      await this.client.functions.invoke("delete-account", {
        body: { confirmation: "EXCLUIR" },
      }),
    );
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(`ew.cloud.draft.${this.user.id}.`))
          localStorage.removeItem(key);
      }
    } catch {
      /* Account was deleted; local browser restrictions may require manual cleanup. */
    }
    await this.client.auth.signOut({ scope: "local" });
  }
  async projects(_profileId: string): Promise<Project[]> {
    const all: Project[] = [];
    for (let offset = 0; ; offset += 500) {
      const rows = checked(
        await this.client
          .from("ew_projects")
          .select("data")
          .order("updated_at", { ascending: false })
          .order("id")
          .range(offset, offset + 499),
      );
      all.push(...rows.map((r) => r.data));
      if (rows.length < 500) return all;
    }
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
    checked(
      await this.client
        .from("ew_projects")
        .insert({ id: p.id, owner_id: this.user.id, data: p }),
    );
    return p;
  }
  async renameProject(p: Project, title: string, description: string) {
    await this.rpc("ew_patch_project", {
      project_id: p.id,
      patch: { title, description },
    });
  }
  async deleteProject(projectId: string) {
    checked(await this.client.from("ew_projects").delete().eq("id", projectId));
  }
  async saveProjectIcon(
    projectId: string,
    icon: ProjectIconId,
  ): Promise<Project> {
    if (!isProjectIconId(icon)) throw Error("Ícone inválido.");
    return this.rpc("ew_patch_project", {
      project_id: projectId,
      patch: { icon },
    });
  }
  async saveProjectCover(
    projectId: string,
    cover: CoverTemplate,
    expected?: CoverTemplate,
  ): Promise<Project> {
    return this.rpc("ew_patch_project", {
      project_id: projectId,
      patch: { cover },
      expected_cover: expected ?? null,
      check_cover: true,
    });
  }
  async documents(projectId: string): Promise<Manuscript[]> {
    const all: Manuscript[] = [];
    for (let offset = 0; ; offset += 500) {
      const rows = checked(
        await this.client
          .from("ew_documents")
          .select("data")
          .eq("project_id", projectId)
          .order("created_at")
          .order("id")
          .range(offset, offset + 499),
      );
      all.push(...rows.map((r) => r.data));
      if (rows.length < 500) return all;
    }
  }
  async createDocument(doc: Manuscript) {
    checked(
      await this.client.from("ew_documents").insert({
        id: doc.id,
        owner_id: this.user.id,
        project_id: doc.projectId,
        revision: doc.revision,
        data: doc,
      }),
    );
  }
  async saveDocument(
    doc: Manuscript,
    expectedRevision: number,
  ): Promise<Manuscript> {
    try {
      return await this.rpc("ew_save_document", {
        document_id: doc.id,
        expected_revision: expectedRevision,
        payload: doc,
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes("EW_CONFLICT"))
        throw new ConflictError();
      throw e;
    }
  }
  async deleteDocument(documentId: string) {
    checked(
      await this.client.from("ew_documents").delete().eq("id", documentId),
    );
  }
  async restore(
    _profileId: string,
    project: Project,
    docs: Manuscript[],
  ): Promise<Project> {
    const p = { ...project, id: id(), profileId: this.user.id, demo: false };
    return this.rpc("ew_import_project", {
      payload: p,
      documents: docs.map((d) => ({
        ...d,
        id: id(),
        projectId: p.id,
        revision: 0,
      })),
    });
  }
}
