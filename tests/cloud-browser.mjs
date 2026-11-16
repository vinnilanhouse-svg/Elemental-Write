// Auth/UI contract test with a deterministic Supabase HTTP fixture, not a live service test.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const uid = "10000000-0000-4000-8000-000000000001";
const user = {
  id: uid,
  email: "ana@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email" },
  user_metadata: { name: "Ana" },
};
const token = () => ({
  access_token:
    "eyJhbGciOiJIUzI1NiJ9." +
    Buffer.from(
      JSON.stringify({ sub: uid, exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url") +
    ".fixture",
  refresh_token: "fixture",
  token_type: "bearer",
  expires_in: 3600,
  user,
});
let profiles = [],
  projects = [],
  documents = [],
  failSave = false,
  failLogin = false,
  recoveries = 0,
  signups = 0,
  accountDeletes = 0;
await page.route(
  "https://hnhygaqrkiuaktuxfewh.supabase.co/**",
  async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      body = req.postDataJSON();
    let data = {},
      status = 200;
    if (url.pathname === "/auth/v1/token") {
      if (failLogin) {
        data = {
          error: "invalid_grant",
          error_description: "Credenciais inválidas",
        };
        status = 400;
      } else data = token();
    } else if (url.pathname === "/auth/v1/signup") {
      signups++;
      data = { user, session: null };
    } else if (url.pathname === "/auth/v1/recover") {
      recoveries++;
      data = {};
    } else if (url.pathname === "/auth/v1/user") {
      data = user;
    } else if (url.pathname === "/auth/v1/logout") data = {};
    else if (url.pathname === "/rest/v1/ew_profiles") {
      if (req.method() === "POST") profiles = [body];
      if (req.method() === "PATCH") profiles[0] = { ...profiles[0], ...body };
      data = profiles;
    } else if (url.pathname === "/rest/v1/ew_projects") data = projects;
    else if (url.pathname === "/rest/v1/ew_documents")
      data = documents.filter(
        (d) =>
          !url.searchParams.has("project_id") ||
          "eq." + d.project_id === url.searchParams.get("project_id"),
      );
    else if (url.pathname === "/rest/v1/rpc/ew_import_project") {
      projects.push({ data: body.payload });
      documents.push(
        ...body.documents.map((d) => ({ project_id: d.projectId, data: d })),
      );
      data = body.payload;
    } else if (url.pathname === "/rest/v1/rpc/ew_export") {
      data = {
        profile: profiles[0].data,
        projects: projects.map((p) => ({
          project: p.data,
          documents: documents
            .filter((d) => d.project_id === p.data.id)
            .map((d) => d.data),
        })),
      };
    } else if (url.pathname === "/functions/v1/delete-account") {
      assert.equal(body.confirmation, "EXCLUIR");
      accountDeletes++;
      data = { message: "Conta excluída" };
    } else if (url.pathname === "/rest/v1/rpc/ew_save_document") {
      if (failSave) {
        status = 503;
        data = { message: "Indisponível temporariamente" };
      } else {
        const row = documents.find((d) => d.data.id === body.document_id);
        if (row.data.revision !== body.expected_revision) {
          status = 409;
          data = { message: "EW_CONFLICT" };
        } else {
          row.data = { ...body.payload, revision: body.expected_revision + 1 };
          data = row.data;
        }
      }
    } else {
      console.error("Unhandled fixture", req.method(), url.pathname);
      status = 400;
      data = { message: "fixture route missing" };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
      headers: { "access-control-allow-origin": "*" },
    });
  },
);
try {
  await page.goto(process.env.BASE_URL || "http://localhost:5175");
  await page.getByRole("button", { name: "Cadastrar", exact: true }).click();
  await page.getByLabel("Nome ou apelido", { exact: true }).fill("Ana");
  await page.getByLabel("E-mail", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("teste-seguro-123");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("confirmar");
  assert.equal(signups, 1);
  await page.getByRole("button", { name: "Já tenho conta" }).click();
  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("recuperação");
  assert.equal(recoveries, 1);
  console.log(
    "PASS cadastro com confirmação e solicitação de recuperação (HTTP simulado)",
  );
  await page
    .getByRole("button", { name: "Continuar com dados locais" })
    .click();
  await page.getByRole("button", { name: "Entendi", exact: true }).click();
  await page.getByLabel("Como podemos chamar você?").fill("Local");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await page.getByRole("heading", { name: /Meus projetos/ }).waitFor();
  await page
    .getByRole("button", { name: "Entrar na nuvem", exact: true })
    .click();
  await page.getByRole("button", { name: "Voltar ao login" }).click();
  failLogin = true;
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Credenciais");
  failLogin = false;
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("heading", { name: /Meus projetos/ }).waitFor();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Transferir projetos locais para a conta" })
    .click();
  await expect(
    page.getByText("1 projetos transferidos. Cópias locais preservadas.", {
      exact: true,
    }),
  ).toBeVisible();
  assert.equal(projects.length, 1);
  assert.equal(documents.length, 2);
  const localCount = await page.evaluate(async () => {
    const { localRepository } = await import("/src/data/repository.ts");
    return (await localRepository.profiles()).length;
  });
  assert.equal(localCount, 1);
  await page.reload();
  await page.getByRole("heading", { name: /Meus projetos/ }).waitFor();
  assert.equal(projects.length, 1);
  console.log(
    "PASS login, erro de credenciais, sessão recarregada e transferência preserva IndexedDB (HTTP simulado)",
  );
  // Drive the actual autosave hook against the remote repository; test error recovery and restart.
  await page.evaluate(async () => {
    const React = await import("/node_modules/.vite/deps/react.js");
    const ReactDOMModule = await import(
      "/node_modules/.vite/deps/react-dom_client.js"
    );
    const { useDocument } = await import("/src/data/useDocument.ts");
    const { repository } = await import("/src/data/repository.ts");
    const [p] = await repository.projects("");
    const docs = await repository.documents(p.id);
    window.cloudInitial = docs[0];
    window.mountCloudHook = () => {
      const host = document.createElement("div");
      document.body.append(host);
      window.hookRoot = (
        ReactDOMModule.createRoot || ReactDOMModule.default.createRoot
      )(host);
      window.hookRoot.render(
        (React.createElement || React.default.createElement)(function () {
          window.hook = useDocument(window.cloudInitial, () => {});
          return null;
        }),
      );
    };
    window.mountCloudHook();
  });
  await page.waitForFunction(() => !!window.hook);
  failSave = true;
  await page.evaluate(() =>
    window.hook.change({ body: "Texto durante falha de rede" }),
  );
  await expect
    .poll(() => page.evaluate(() => window.hook.status))
    .toBe("Erro ao salvar");
  assert.equal(
    await page.evaluate(() => window.hook.latest.current.body),
    "Texto durante falha de rede",
  );
  await page.evaluate(() => window.hookRoot.unmount());
  await page.evaluate(() => {
    window.hook = null;
    window.mountCloudHook();
  });
  await page.waitForFunction(() => !!window.hook);
  assert.equal(
    await page.evaluate(() => window.hook.latest.current.body),
    "Texto durante falha de rede",
  );
  failSave = false;
  await page.evaluate(() => window.hook.flush());
  await expect
    .poll(() => page.evaluate(() => window.hook.status))
    .toBe("Salvo na nuvem");
  assert.equal(documents[0].data.body, "Texto durante falha de rede");
  assert.equal(documents[0].data.revision, 1);
  console.log(
    "PASS autosave remoto, erro mantém texto, rascunho recuperado após remontagem e nova tentativa salva",
  );
  await page.evaluate(() => window.hookRoot.unmount());
  await page
    .getByRole("button", { name: "Abrir navegação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Entrar na nuvem", exact: true })
    .waitFor();
  console.log("PASS saída da conta pela interface");
  await page.evaluate(() =>
    localStorage.setItem(
      "sb-hnhygaqrkiuaktuxfewh-auth-token-code-verifier",
      JSON.stringify("fixture/recovery"),
    ),
  );
  await page.goto(
    (process.env.BASE_URL || "http://localhost:5175") +
      "/?code=fixture-recovery",
  );
  await page
    .getByRole("heading", { name: "Definir nova senha", exact: true })
    .waitFor();
  await page.getByLabel("Senha", { exact: true }).fill("nova-senha-segura-123");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("heading", { name: /Meus projetos/ }).waitFor();
  console.log(
    "PASS callback PKCE de recuperação e alteração da senha (HTTP simulado)",
  );
  await page.evaluate(() =>
    localStorage.setItem(
      "sb-hnhygaqrkiuaktuxfewh-auth-token-code-verifier",
      JSON.stringify("fixture"),
    ),
  );
  await page.goto(
    (process.env.BASE_URL || "http://localhost:5175") +
      "/?code=fixture-confirm",
  );
  await page.getByRole("heading", { name: /Meus projetos/ }).waitFor();
  console.log("PASS callback PKCE de confirmação de e-mail (HTTP simulado)");
  await page
    .getByRole("button", { name: "Privacidade e seus dados", exact: true })
    .click();
  const center = page.getByRole("dialog", {
    name: "Privacidade e seus dados",
    exact: true,
  });
  await expect(center.getByText(/1 projetos/)).toBeVisible();
  await center
    .getByLabel("Nome ou apelido", { exact: true })
    .fill("Ana Corrigida");
  await center
    .getByRole("button", { name: "Salvar dados do perfil", exact: true })
    .click();
  await expect(
    center.getByText("Perfil atualizado.", { exact: true }),
  ).toBeVisible();
  assert.equal(profiles[0].data.name, "Ana Corrigida");
  const downloadPromise = page.waitForEvent("download");
  await center
    .getByRole("button", { name: "Baixar meus dados", exact: true })
    .click();
  const archive = await downloadPromise;
  assert.match(archive.suggestedFilename(), /dados.zip$/);
  await center
    .getByRole("button", { name: "Excluir meu perfil e dados", exact: true })
    .click();
  await center.getByLabel("Digite EXCLUIR para confirmar").fill("EXCLUIR");
  await expect(
    center.getByRole("button", {
      name: "Excluir definitivamente",
      exact: true,
    }),
  ).toBeDisabled();
  await center
    .getByLabel("Confirme sua senha atual")
    .fill("nova-senha-segura-123");
  await center
    .getByRole("button", { name: "Excluir definitivamente", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Entrar na nuvem", exact: true })
    .waitFor();
  assert.equal(accountDeletes, 1);
  console.log(
    "PASS consulta, correção, exportação e exclusão da conta com senha pela interface (HTTP simulado)",
  );
  assert.deepEqual(errors, []);
} catch (e) {
  console.error((await page.locator("body").innerText()).slice(0, 4000));
  throw e;
} finally {
  await browser.close();
}
