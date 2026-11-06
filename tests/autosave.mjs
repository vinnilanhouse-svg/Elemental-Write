import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://localhost:5174");
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
  await page.evaluate(async () => {
    window.harness = await import("/tests/autosave-harness.tsx");
    await window.harness.mount();
  });
  const startTyping = async (prefix) =>
    page.evaluate((prefix) => {
      window.edits = 0;
      window.typing = setInterval(() => {
        window.harness.change(prefix + " " + ++window.edits);
      }, 500);
    }, prefix);
  const snapshot = () => page.evaluate(() => window.harness.snapshot());
  await startTyping("Primeira versão");
  await page.clock.runFor(299999);
  assert.equal(
    (await snapshot()).revision,
    0,
    "A digitação contínua deve manter o debounce pendente antes dos cinco minutos.",
  );
  await page.evaluate(() => clearInterval(window.typing));
  await page.clock.runFor(1);
  await expect.poll(async () => (await snapshot()).revision).toBe(1);
  assert.equal(
    (await snapshot()).doc.content[0].content[0].text,
    "Primeira versão 599",
  );
  console.log(
    "PASS salva aos cinco minutos durante digitação contínua, sem depender do debounce",
  );
  await page.clock.runFor(300000);
  assert.equal((await snapshot()).revision, 1);
  console.log("PASS não grava novamente quando não há alterações");
  await startTyping("Versão mais recente");
  await page.clock.runFor(299999);
  assert.equal((await snapshot()).revision, 1);
  await page.evaluate(() => clearInterval(window.typing));
  await page.clock.runFor(1);
  await expect.poll(async () => (await snapshot()).revision).toBe(2);
  assert.equal(
    (await snapshot()).doc.content[0].content[0].text,
    "Versão mais recente 599",
  );
  console.log("PASS ciclos posteriores salvam a edição mais recente");
  await page.evaluate(() => {
    window.harness.change("Não gravar depois de desmontar");
    window.harness.unmount();
  });
  await page.clock.runFor(300000);
  assert.equal((await snapshot()).revision, 2);
  assert.equal(
    (await snapshot()).doc.content[0].content[0].text,
    "Versão mais recente 599",
  );
  console.log("PASS limpa os temporizadores quando o documento é fechado");
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
