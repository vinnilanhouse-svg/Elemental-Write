import { dismissPrivacyNotice } from "./browser-support.mjs";
import { chromium, expect } from "@playwright/test";
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
let page;
try {
  await fs.mkdir("artifacts", { recursive: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.BASE_URL || "http://localhost:5176");
  await dismissPrivacyNotice(page);
  const ids = await page.evaluate(async () => {
    const { repository: r } = await import("/src/data/repository.ts");
    const { makeManuscript } = await import("/src/model.ts");
    const profile = await r.addProfile("Ana", "ana@example.com");
    const car = await r.createProject(profile.id, "Papo de Garagem");
    const videos = await r.createProject(profile.id, "Vídeos institucionais");
    await r.createDocument(makeManuscript(car.id, "Episódio 1"));
    localStorage.setItem("ew.profile", profile.id);
    return { car: car.id, videos: videos.id };
  });
  await page.reload();
  await page.getByRole("heading", { name: "Meus projetos" }).waitFor();
  const card = (title) =>
    page
      .locator(".project-card")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  const car = card("Papo de Garagem"),
    videos = card("Vídeos institucionais");
  const picker = page.getByRole("dialog", {
    name: "Escolher ícone",
    exact: true,
  });
  const choices = picker
    .getByRole("group", { name: "Opções de ícone" })
    .getByRole("button");
  const open = async (title) => {
    await card(title)
      .getByLabel("Opções do projeto " + title, { exact: true })
      .click();
    await card(title)
      .getByRole("button", { name: "Escolher ícone", exact: true })
      .click();
    await picker.waitFor();
  };
  await open("Papo de Garagem");
  await expect(choices).toHaveCount(20);
  const drawings = await choices
    .locator("svg[data-project-icon]")
    .evaluateAll((els) => els.map((el) => el.innerHTML));
  assert.equal(
    new Set(drawings).size,
    20,
    "As 20 opções devem ter desenhos diferentes.",
  );
  await expect(
    picker.getByRole("button", { name: "Usar ícone Claquete", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await picker
    .getByRole("button", { name: "Usar ícone Automóvel", exact: true })
    .click();
  await expect(
    picker.locator(".project-icon-preview [data-project-icon=car]"),
  ).toHaveCount(1);
  await expect(
    car.locator(".cover [data-project-icon=clapperboard]"),
  ).toHaveCount(1);
  await page.screenshot({ path: "artifacts/opcoes-20-icones.png" });
  await picker.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    car.locator(".cover [data-project-icon=clapperboard]"),
  ).toHaveCount(1);
  await open("Papo de Garagem");
  await picker
    .getByRole("button", { name: "Usar ícone Automóvel", exact: true })
    .click();
  await picker
    .getByRole("button", { name: "Salvar ícone", exact: true })
    .click();
  await picker.waitFor({ state: "hidden" });
  await expect(car.locator(".cover [data-project-icon=car]")).toHaveCount(1);
  await expect(
    videos.locator(".cover [data-project-icon=clapperboard]"),
  ).toHaveCount(1);
  await page.reload();
  await expect(car.locator(".cover [data-project-icon=car]")).toHaveCount(1);
  console.log(
    "PASS 20 ícones distintos, prévia, cancelamento, persistência e escolha independente por projeto",
  );

  await car.getByRole("button").first().click();
  const editor = page.locator(".screenplay");
  await editor.focus();
  await page.keyboard.type("INT. GARAGEM — DIA");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Uma conversa começa.");
  const nav = async () => {
    await page
      .getByRole("button", { name: "Abrir navegação", exact: true })
      .click();
    const drawer = page.getByRole("dialog", {
      name: "Seus documentos",
      exact: true,
    });
    await drawer.waitFor();
    return drawer;
  };
  const drawer = await nav();
  await drawer.getByLabel("Opções do projeto", { exact: true }).click();
  await drawer
    .getByRole("button", { name: "Escolher ícone", exact: true })
    .click();
  await picker.waitFor();
  const film = picker.getByRole("button", {
    name: "Usar ícone Película",
    exact: true,
  });
  await film.focus();
  await page.keyboard.press("Space");
  await expect(film).toHaveAttribute("aria-pressed", "true");
  await picker
    .getByRole("button", { name: "Salvar ícone", exact: true })
    .click();
  await picker.waitFor({ state: "hidden" });
  assert.match(await editor.innerText(), /Uma conversa começa/);
  await page.keyboard.press("Control+s");
  await page
    .getByRole("status", { name: "Salvo neste navegador", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(async (id) => {
      const { repository: r } = await import("/src/data/repository.ts");
      return (await r.projects(localStorage.getItem("ew.profile"))).find(
        (p) => p.id === id,
      ).icon;
    }, ids.car),
    "film",
  );
  console.log(
    "PASS menu do projeto durante a escrita e seleção por teclado sem perder o roteiro",
  );

  const drawer2 = await nav();
  await drawer2.getByRole("button", { name: /^Meus projetos/ }).click();
  await open("Papo de Garagem");
  await picker
    .getByRole("button", { name: "Usar ícone Microfone", exact: true })
    .click();
  await page.evaluate(async () => {
    const { repository: r } = await import("/src/data/repository.ts");
    window.originalIconSave = r.saveProjectIcon;
    r.saveProjectIcon = async () => {
      throw Error("Falha simulada ao salvar ícone.");
    };
  });
  await picker
    .getByRole("button", { name: "Salvar ícone", exact: true })
    .click();
  await expect(picker.getByRole("alert")).toHaveText(
    "Falha simulada ao salvar ícone.",
  );
  await expect(car.locator(".cover [data-project-icon=film]")).toHaveCount(1);
  await page.evaluate(async () => {
    const { repository: r } = await import("/src/data/repository.ts");
    r.saveProjectIcon = window.originalIconSave;
  });
  await picker
    .getByRole("button", { name: "Salvar ícone", exact: true })
    .click();
  await picker.waitFor({ state: "hidden" });
  await expect(car.locator(".cover [data-project-icon=mic]")).toHaveCount(1);
  console.log(
    "PASS falha de gravação mantém a escolha anterior e permite tentar novamente",
  );

  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await open("Vídeos institucionais");
    await expect(choices).toHaveCount(20);
    assert.equal(
      await picker.evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
      "Sem overflow no seletor em " + width,
    );
    assert.equal(
      await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
      true,
    );
    await picker
      .getByRole("button", { name: "Usar ícone Montanhas", exact: true })
      .click();
    if (width === 390) {
      await picker.evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.screenshot({ path: "artifacts/opcoes-20-icones-mobile.png" });
    }
    if (width === 320) {
      await picker
        .getByRole("button", { name: "Salvar ícone", exact: true })
        .click();
      await picker.waitFor({ state: "hidden" });
    } else {
      await page.keyboard.press("Escape");
      await picker.waitFor({ state: "hidden" });
    }
  }
  await expect(
    videos.locator(".cover [data-project-icon=mountain]"),
  ).toHaveCount(1);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "artifacts/projetos-icones-personalizados.png",
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS 20 opções acessíveis no celular, teclado e cartões atualizados",
  );
} catch (error) {
  if (page)
    await page.screenshot({ path: "artifacts/project-icons-failure.png" });
  throw error;
} finally {
  await browser.close();
}
