import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import JSZip from "jszip";
const base = process.env.BASE_URL || "http://localhost:5181";
const origin = new URL(base).origin;
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
let page;
try {
  await fs.mkdir("artifacts", { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    timezoneId: "America/Sao_Paulo",
  });
  page = await context.newPage();
  const errors = [],
    requests = [],
    violations = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith(origin) && !r.url().startsWith("blob:"))
      requests.push(r.url());
  });
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.cspViolations.push({
        directive: e.effectiveDirective,
        blocked: e.blockedURI,
      }),
    );
  });
  const response = await page.goto(base);
  assert.equal(response.headers()["x-content-type-options"], "nosniff");
  assert.equal(response.headers()["referrer-policy"], "no-referrer");
  assert.match(
    response.headers()["content-security-policy"],
    /connect-src 'self'/,
  );
  const notice = page.getByRole("region", {
    name: "Aviso de privacidade e armazenamento",
    exact: true,
  });
  await notice.waitFor();
  assert.match(
    await notice.innerText(),
    /não instala cookies de publicidade ou análise/,
  );
  await expect(
    page.getByLabel("E-mail do perfil (opcional)"),
  ).not.toHaveAttribute("required", "");
  await page.screenshot({ path: "artifacts/privacidade-aviso.png" });
  await notice.getByRole("button", { name: "Entendi", exact: true }).click();
  await page.reload();
  await expect(notice).toHaveCount(0);
  assert.deepEqual(await context.cookies(), []);
  console.log(
    "PASS aviso transparente, e-mail opcional e nenhuma instalação de cookies",
  );

  const noJS = await browser.newContext({ javaScriptEnabled: false });
  const legal = await noJS.newPage();
  for (const route of ["/privacidade.html", "/termos.html"]) {
    const res = await legal.goto(origin + route);
    assert.equal(res.status(), 200);
    await expect(legal.getByRole("heading", { level: 1 })).toBeVisible();
    assert.match(await legal.locator("main").innerText(), /Elemental Corp/);
    assert.match(
      await legal.locator("main").innerText(),
      /coradi.maddaloni@gmail.com/,
    );
  }
  await noJS.close();
  console.log(
    "PASS páginas públicas de privacidade e termos disponíveis sem JavaScript",
  );

  const createProfile = async (name) => {
    await page.getByLabel("Como podemos chamar você?").fill(name);
    await page
      .getByRole("button", { name: "Entrar no meu espaço", exact: true })
      .click();
    await page.getByRole("heading", { name: "Meus projetos" }).waitFor();
  };
  const nav = async () => {
    await page
      .getByRole("button", { name: "Abrir navegação", exact: true })
      .click();
    const d = page.getByRole("dialog", {
      name: "Seus documentos",
      exact: true,
    });
    await d.waitFor();
    return d;
  };
  const logout = async () => {
    const d = await nav();
    await d
      .getByRole("button", { name: "Sair do perfil", exact: true })
      .click();
    await page.locator(".profile-list").waitFor();
  };
  await createProfile("Pessoa A");
  await logout();
  await page
    .getByRole("button", { name: "Criar outro perfil", exact: true })
    .click();
  await createProfile("Pessoa B");
  await logout();
  await page
    .locator(".profile-list button")
    .filter({ has: page.getByText("Pessoa A", { exact: true }) })
    .click();
  await page
    .locator(".project-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Além do horizonte",
        exact: true,
      }),
    })
    .getByRole("button")
    .first()
    .click();
  const editor = page.locator(".screenplay");
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("ALTERACAO_PRIVACIDADE_ULTIMA.");
  await page.getByRole("button", { name: "Mais opções", exact: true }).click();
  await page
    .getByRole("button", { name: "Privacidade e seus dados", exact: true })
    .click();
  const center = page.getByRole("dialog", {
    name: "Privacidade e seus dados",
    exact: true,
  });
  await center.waitFor();
  await center
    .getByLabel("Nome ou apelido", { exact: true })
    .fill("Autora Local");
  await center
    .getByLabel("E-mail do perfil (opcional)")
    .fill("autora@example.com");
  await center
    .getByRole("button", { name: "Salvar dados do perfil", exact: true })
    .click();
  await center
    .getByRole("status")
    .filter({ hasText: "Perfil atualizado" })
    .waitFor();
  const zipDownload = page.waitForEvent("download");
  await center
    .getByRole("button", { name: "Baixar meus dados", exact: true })
    .click();
  const zipFile = await zipDownload;
  await zipFile.saveAs("artifacts/meus-dados.zip");
  const zip = await JSZip.loadAsync(
    await fs.readFile("artifacts/meus-dados.zip"),
  );
  const data = JSON.parse(await zip.file("perfil.json").async("string"));
  assert.equal(data.profile.name, "Autora Local");
  assert.equal(data.profile.email, "autora@example.com");
  const projects = Object.keys(zip.files).filter(
    (p) => p.startsWith("projetos/") && p.endsWith(".json"),
  );
  assert.equal(projects.length, 1);
  const exported = JSON.parse(await zip.file(projects[0]).async("string"));
  assert.ok(JSON.stringify(exported).includes("ALTERACAO_PRIVACIDADE_ULTIMA"));
  assert.ok(!JSON.stringify(exported).includes("Pessoa B"));
  await page.screenshot({ path: "artifacts/privacidade-seus-dados.png" });
  console.log(
    "PASS consulta, correção e download completo com as últimas alterações e isolamento entre perfis",
  );

  await center
    .getByRole("button", { name: "Rever aviso de armazenamento", exact: true })
    .click();
  await notice.waitFor();
  await notice.getByRole("button", { name: "Entendi", exact: true }).click();
  const pdfDownload = page.waitForEvent("download");
  await page.locator(".export-menu > summary").click();
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const pdfFile = await pdfDownload;
  const pdfPath = "artifacts/privacidade-com-csp.pdf";
  await pdfFile.saveAs(pdfPath);
  const pdf = await fs.readFile(pdfPath);
  assert.ok(pdf.toString("ascii", 0, 4) === "%PDF");
  await page.locator('input[type="file"]').setInputFiles({
    name: "privacidade.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  const imported = page.getByRole("dialog", {
    name: "Revisar importação",
    exact: true,
  });
  await imported.waitFor();
  assert.match(await imported.innerText(), /ALTERACAO_PRIVACIDADE_ULTIMA/);
  await imported.getByRole("button", { name: "Fechar", exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
  const blocked = await page.evaluate(async () => {
    try {
      await fetch("https://example.invalid/blocked-privacy-probe");
      return false;
    } catch {
      return true;
    }
  });
  assert.equal(blocked, true);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.cspViolations.some(
          (v) =>
            v.directive === "connect-src" &&
            v.blocked.includes("example.invalid"),
        ),
      ),
    )
    .toBe(true);
  console.log(
    "PASS exportação/importação PDF sob CSP e bloqueio de conexões externas não autorizadas",
  );

  const other = await context.newPage();
  await other.goto(base);
  await other.getByRole("heading", { name: "Meus projetos" }).waitFor();
  await other
    .locator(".project-card")
    .filter({
      has: other.getByRole("heading", {
        name: "Além do horizonte",
        exact: true,
      }),
    })
    .getByRole("button")
    .first()
    .click();
  await other.locator(".screenplay").focus();
  await other.keyboard.press("Control+End");
  await other.keyboard.type(" RASCUNHO_NAO_RECRIAR.");
  await page.getByRole("button", { name: "Mais opções", exact: true }).click();
  await page
    .getByRole("button", { name: "Privacidade e seus dados", exact: true })
    .click();
  await center.waitFor();
  await center
    .getByRole("button", { name: "Excluir meu perfil e dados", exact: true })
    .click();
  await expect(
    center.getByRole("button", {
      name: "Excluir definitivamente",
      exact: true,
    }),
  ).toBeDisabled();
  await center.getByLabel("Digite EXCLUIR para confirmar").fill("EXCLUIR");
  await center
    .getByRole("button", { name: "Excluir definitivamente", exact: true })
    .click();
  await center.waitFor({ state: "hidden" });
  await page.locator(".profile-list").waitFor();
  await other.locator(".profile-list").waitFor();
  await expect(page.locator(".profile-list")).toContainText("Pessoa B");
  await expect(page.locator(".profile-list")).not.toContainText("Autora Local");
  await expect(other.locator(".screenplay")).toHaveCount(0);
  await page.waitForTimeout(900);
  const remaining = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("elemental-write");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(
            ["people", "folders", "manuscripts"],
            "readonly",
          );
          const values = {};
          for (const store of ["people", "folders", "manuscripts"]) {
            const r = tx.objectStore(store).getAll();
            r.onsuccess = () => {
              values[store] = r.result;
            };
          }
          tx.oncomplete = () => {
            db.close();
            resolve(values);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  assert.equal(remaining.people.length, 1);
  assert.equal(remaining.people[0].name, "Pessoa B");
  const projectIds = new Set(remaining.folders.map((p) => p.id));
  assert.ok(
    remaining.folders.every((p) => p.profileId === remaining.people[0].id),
  );
  assert.ok(remaining.manuscripts.every((d) => projectIds.has(d.projectId)));
  assert.ok(
    !JSON.stringify(remaining).includes("ALTERACAO_PRIVACIDADE_ULTIMA"),
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("ew.profile")),
    null,
  );
  await other.close();
  console.log(
    "PASS exclusão confirmada apenas do perfil escolhido, atualização de outra aba e ausência de recriação pelo autosave",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Privacidade e seus dados", exact: true })
    .click();
  await center.waitFor();
  assert.equal(
    await center.evaluate((el) => el.scrollWidth <= el.clientWidth),
    true,
  );
  await page.screenshot({ path: "artifacts/privacidade-mobile.png" });
  await page.keyboard.press("Escape");
  const external = requests.filter(
    (url) => !url.includes("example.invalid/blocked-privacy-probe"),
  );
  assert.deepEqual(external, []);
  assert.deepEqual(await context.cookies(), []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS privacidade no celular e ausência de requisições de rastreamento",
  );
  await context.close();
} catch (error) {
  if (page) await page.screenshot({ path: "artifacts/privacy-failure.png" });
  throw error;
} finally {
  await browser.close();
}
