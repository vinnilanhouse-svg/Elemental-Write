// Executes the production migration against PostgreSQL in WASM, including RLS roles.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002";
const p = "20000000-0000-4000-8000-000000000001",
  d = "30000000-0000-4000-8000-000000000001";
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email','test@example.invalid') $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid(),auth.jwt() to authenticated;`);
  await db.exec(
    await fs.readFile(
      new URL("../supabase/migrations/202611160001_cloud.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.query("insert into auth.users values ($1),($2)", [a, b]);
  await db.exec("set role authenticated");
  const asUser = (uid) =>
    db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await asUser(a);
  const project = {
    id: p,
    profileId: a,
    title: "Projeto com capa",
    description: "Descrição",
    createdAt: 1,
    updatedAt: 2,
    icon: "car",
    cover: { version: 1, blocks: [{ text: "{autor}" }] },
  };
  const doc = {
    id: d,
    projectId: p,
    kind: "script",
    revision: 0,
    title: "Roteiro",
    doc: {
      type: "doc",
      content: [
        {
          type: "block",
          attrs: { kind: "insert" },
          content: [
            {
              type: "text",
              text: "INSERT TEXTO",
              marks: [{ type: "highlight" }],
            },
          ],
        },
      ],
    },
    body: "Nota",
    author: "Autor",
    paper: "a4",
    titlePage: true,
    createdAt: 1,
    updatedAt: 2,
    mirror: { rows: [{ lettering: "Texto" }] },
  };
  await db.query("insert into public.ew_profiles values ($1,$2)", [
    a,
    {
      id: a,
      name: "A",
      email: "a@example.invalid",
      theme: "dark",
      createdAt: 1,
    },
  ]);
  await db.query("select public.ew_import_project($1,$2)", [
    project,
    JSON.stringify([doc]),
  ]);
  let exported = (await db.query("select public.ew_export() as snapshot"))
    .rows[0].snapshot;
  assert.deepEqual(exported.projects[0], { project, documents: [doc] });
  console.log(
    "PASS transferência transacional preserva todos os campos e exportação",
  );
  const saved = (
    await db.query("select public.ew_save_document($1,0,$2) as doc", [
      d,
      { ...doc, body: "Atualizado" },
    ])
  ).rows[0].doc;
  assert.equal(saved.revision, 1);
  assert.equal(saved.body, "Atualizado");
  assert.deepEqual(saved.mirror, doc.mirror);
  await assert.rejects(
    db.query("select public.ew_save_document($1,0,$2)", [d, doc]),
    /EW_CONFLICT/,
  );
  assert.equal(
    (await db.query("select data from public.ew_documents where id=$1", [d]))
      .rows[0].data.body,
    "Atualizado",
  );
  console.log(
    "PASS salvamento, recarga e conflito não sobrescreve a versão mais recente",
  );
  await asUser(b);
  assert.equal(
    (await db.query("select * from public.ew_projects")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.ew_documents")).rows.length,
    0,
  );
  await assert.rejects(
    db.query("select public.ew_save_document($1,1,$2)", [d, doc]),
    /EW_CONFLICT/,
  );
  await assert.rejects(
    db.query("select public.ew_patch_project($1,$2)", [p, { title: "Ataque" }]),
    /indisponível/,
  );
  await db.query("delete from public.ew_projects where id=$1", [p]);
  await assert.rejects(
    db.query(
      "insert into public.ew_documents(id,owner_id,project_id,revision,data) values($1,$2,$3,0,$4)",
      [
        "30000000-0000-4000-8000-000000000002",
        b,
        p,
        { ...doc, id: "30000000-0000-4000-8000-000000000002" },
      ],
    ),
    /foreign key/,
  );
  await assert.rejects(
    db.query(
      "insert into public.ew_projects(id,owner_id,data) values($1,$2,$3)",
      [
        "20000000-0000-4000-8000-000000000002",
        a,
        { ...project, id: "20000000-0000-4000-8000-000000000002" },
      ],
    ),
    /row-level security/,
  );
  console.log(
    "PASS RLS impede leitura, inserção, alteração, exclusão e referência cruzada entre contas",
  );
  await asUser(a);
  await db
    .query("select public.ew_patch_project($1,$2,null,true)", [
      p,
      { cover: null },
    ])
    .then(
      () => assert.fail("deveria detectar conflito de capa"),
      (e) => assert.match(e.message, /capa foi alterada/),
    );
  await db.query("select public.ew_patch_project($1,$2)", [
    p,
    { icon: "book" },
  ]);
  assert.equal(
    (await db.query("select data from public.ew_projects")).rows[0].data.icon,
    "book",
  );
  const badProject = { ...project, id: "20000000-0000-4000-8000-000000000003" };
  await assert.rejects(
    db.query("select public.ew_import_project($1,$2)", [
      badProject,
      JSON.stringify([doc]),
    ]),
    /check constraint/,
  );
  assert.equal(
    (await db.query("select * from public.ew_projects")).rows.length,
    1,
  );
  console.log(
    "PASS conflito de capa e transferência com falha reverte projeto inteiro",
  );
  await db.exec("reset role");
  await db.query("delete from auth.users where id=$1", [a]);
  assert.equal(
    (await db.query("select * from public.ew_projects")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.ew_documents")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.ew_profiles")).rows.length,
    0,
  );
  console.log(
    "PASS exclusão de usuário remove perfil, projetos e documentos em cascata",
  );
} finally {
  await db.close();
}
