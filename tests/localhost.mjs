import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:5173");
  await page.getByLabel("Como podemos chamar você?").fill("Perfil localhost");
  await page.getByLabel("E-mail do perfil").fill("teste@localhost.example");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await page.locator(".project-open").first().click();
  await page.locator(".screenplay").click();
  await page.keyboard.press("Control+End");
  await page
    .getByLabel("Tipo do bloco", { exact: true })
    .selectOption("action");
  await page.keyboard.type(" Versão localhost verificada.");
  await page.getByRole("button", { name: "Salvar agora", exact: true }).click();
  await page
    .locator(".save-state")
    .filter({ hasText: /^Salvo neste navegador$/ })
    .waitFor();
  await page.reload();
  await page.locator(".project-open").first().click();
  assert.match(
    await page.locator(".screenplay").innerText(),
    /Versão localhost verificada/,
  );
  console.log(
    "PASS pacote extraído: perfil, editor e persistência após recarregar",
  );
  for (const format of ["PDF", "DOCX"]) {
    await page.getByText("Exportar", { exact: true }).click();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: format, exact: true }).click();
    const download = await pending;
    const target = "artifacts/localhost." + format.toLowerCase();
    await download.saveAs(target);
    const bytes = await fs.readFile(target);
    assert.ok(bytes.length > 5000);
    assert.equal(
      bytes.subarray(0, format === "PDF" ? 4 : 2).toString(),
      format === "PDF" ? "%PDF" : "PK",
    );
    await page.locator("input[type=file]").setInputFiles(target);
    const preview = page.getByRole("dialog", { name: "Revisar importação" });
    await preview.waitFor();
    assert.match(await preview.innerText(), /Versão localhost verificada/);
    await preview
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    console.log(
      "PASS pacote extraído: exportação e prévia de importação " + format,
    );
  }
  assert.deepEqual(errors, []);
  const missing = await page.request.get(
    "http://localhost:5173/arquivo-inexistente.js",
  );
  assert.equal(missing.status(), 404);
  const escaped = await page.request.get(
    "http://localhost:5173/%2e%2e%2fLEIA-ME.txt",
  );
  assert.equal(escaped.status(), 403);
  console.log(
    "PASS servidor local: arquivos inexistentes e acesso fora da pasta app recusados",
  );
} finally {
  await browser.close();
}
