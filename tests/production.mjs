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
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("PAGE ERROR", e.message);
  });
  await page.goto(process.env.BASE_URL || "http://localhost:5175");
  await dismissPrivacyNotice(page);
  const seeded = await page.evaluate(async () => {
    const { repository: r } = await import("/src/data/repository.ts");
    const { makeManuscript, block } = await import("/src/model.ts");
    const profile = await r.addProfile("Ana", "ana@example.com");
    const project = await r.createProject(
      profile.id,
      "Produção Aurora",
      "Teste de produção.",
    );
    const d = makeManuscript(project.id, "Filme principal");
    d.author = "Ana Roteirista";
    d.doc = {
      type: "doc",
      content: [
        block("scene", "INT. CASA — DIA"),
        block("action", "A porta se abre."),
        block("shot", "PLANO MÉDIO — LIA."),
        block("character", "LIA"),
        block("parenthetical", "(calmamente)"),
        block("dialogue", "Primeira fala."),
        block("character", "BRUNO"),
        block("dialogue", "Segunda fala."),
        block("character", "LIA"),
        block("dialogue", "Terceira fala."),
        block("action", "Lia sai."),
        block("scene", "EXT. PARQUE — DIA"),
        block("insert", 'INSERT "AMANHÃ"'),
        block("shot", "VOICE OVER (VO) — A cidade acordou."),
        block("scene", "INT. QUARTO — NOITE"),
        block("action", "O relógio toca."),
      ],
    };
    await r.createDocument(d);
    const other = makeManuscript(project.id, "Outro roteiro");
    other.createdAt = d.createdAt + 1;
    other.author = "Bruno";
    other.doc = {
      type: "doc",
      content: [
        block("scene", "EXT. RUA — DIA"),
        block("character", "BRUNO"),
        block("dialogue", "Outra história."),
      ],
    };
    await r.createDocument(other);
    const note = makeManuscript(project.id, "Notas", "note");
    note.createdAt = d.createdAt + 2;
    await r.createDocument(note);
    localStorage.setItem("ew.profile", profile.id);
    return { projectId: project.id, docId: d.id, otherId: other.id };
  });
  await page.reload();
  const openProject = async () => {
    await page.getByRole("heading", { name: "Meus projetos" }).waitFor();
    await page
      .locator(".project-card")
      .filter({
        has: page.getByRole("heading", {
          name: "Produção Aurora",
          exact: true,
        }),
      })
      .getByRole("button")
      .first()
      .click();
    await page.locator(".screenplay").waitFor();
  };
  const nav = async () => {
    const drawer = page.getByRole("dialog", { name: "Seus documentos" });
    if (!(await drawer.isVisible()))
      await page.getByRole("button", { name: "Abrir navegação" }).click();
    await drawer.waitFor();
    return drawer;
  };
  const openMirror = async (name) => {
    const drawer = await nav();
    await drawer.getByLabel("Opções de " + name, { exact: true }).click();
    await drawer
      .locator(".doc-row")
      .filter({ has: page.getByRole("button", { name, exact: true }) })
      .getByRole("button", { name: "Espelho", exact: true })
      .click();
    await page.getByRole("region", { name: "Espelho do roteiro" }).waitFor();
  };
  const saved = async () => {
    await page.keyboard.press("Control+s");
    await page
      .getByRole("status", { name: "Salvo neste navegador", exact: true })
      .waitFor();
  };
  const download = async (trigger, name) => {
    const pending = page.waitForEvent("download");
    await trigger();
    const file = await pending;
    await file.saveAs("artifacts/" + name);
    return fs.readFile("artifacts/" + name);
  };
  const scriptPDF = () =>
    download(async () => {
      await page.locator(".export-menu>summary").click();
      await page.getByRole("button", { name: "PDF", exact: true }).click();
    }, "roteiro-com-capa.pdf");
  const pdfInfo = async (bytes) =>
    page.evaluate(
      async (data) => {
        const pdfjs = await import("/node_modules/pdfjs-dist/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc =
          "/node_modules/pdfjs-dist/build/pdf.worker.min.mjs";
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) })
          .promise;
        const pages = [];
        try {
          for (let i = 1; i <= pdf.numPages; i++) {
            const p = await pdf.getPage(i);
            const content = await p.getTextContent();
            const v = p.getViewport({ scale: 1 });
            const items = content.items
              .filter((item) => "str" in item && item.str.trim())
              .map((item) => ({
                text: item.str,
                x: item.transform[4],
                y: item.transform[5],
                width: item.width,
              }));
            pages.push({
              text: items.map((item) => item.text).join(" "),
              items,
              width: v.width,
              height: v.height,
            });
          }
        } finally {
          await pdf.destroy();
        }
        return pages;
      },
      [...bytes],
    );
  await openProject();
  let pdf = await pdfInfo(await scriptPDF());
  assert.match(pdf[0].text, /Produção Aurora/);
  assert.match(pdf[0].text, /Filme principal/);
  assert.match(pdf[0].text, /Ana Roteirista/);
  assert.ok(!pdf[0].text.includes("INT. CASA"));
  assert.match(pdf[1].text, /1\. INT\. CASA/);
  console.log(
    "PASS capa automática do projeto e roteiro; numeração começa depois da capa",
  );
  const drawer = await nav();
  await drawer.getByLabel("Opções do projeto", { exact: true }).click();
  await drawer
    .getByRole("button", { name: "Editar capa", exact: true })
    .click();
  const cover = page.getByRole("dialog", { name: "Editar capa do projeto" });
  await cover.waitFor();
  await cover
    .getByLabel("Texto do bloco", { exact: true })
    .fill(
      "PROJETO: {projeto}\nROTEIRO: {roteiro}\n\nEscrito por\n{autor}\nVersão para aprovação",
    );
  await cover
    .getByRole("button", { name: "Negrito na capa", exact: true })
    .click();
  await cover.getByLabel("Tamanho da fonte").fill("14");
  await cover
    .getByRole("button", { name: "Adicionar texto", exact: true })
    .click();
  await cover
    .getByLabel("Texto do bloco", { exact: true })
    .fill("Contato: produção@aurora.com");
  await cover.getByLabel("Vertical (%)", { exact: true }).fill("84");
  const block = await cover
    .getByRole("button", { name: "Posicionar bloco 3", exact: true })
    .boundingBox();
  await page.mouse.move(block.x + block.width / 2, block.y + block.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    block.x + block.width / 2 + 8,
    block.y + block.height / 2 - 12,
  );
  await page.mouse.up();
  assert.notEqual(await cover.getByLabel("Vertical (%)").inputValue(), "84");
  await cover.getByLabel("Roteiro da prévia").selectOption(seeded.otherId);
  assert.match(
    await cover
      .getByRole("img", { name: "Prévia da capa do roteiro" })
      .textContent(),
    /Outro roteiro/,
  );
  await cover.getByLabel("Roteiro da prévia").selectOption(seeded.docId);
  await page.screenshot({ path: "artifacts/editor-capa.png" });
  await cover.getByRole("button", { name: "Salvar capa", exact: true }).click();
  await cover.waitFor({ state: "hidden" });
  pdf = await pdfInfo(await scriptPDF());
  assert.match(pdf[0].text, /PROJETO: Produção Aurora/);
  assert.match(pdf[0].text, /ROTEIRO: Filme principal/);
  assert.match(pdf[0].text, /produção@aurora.com/);
  assert.match(pdf[0].text, /Versão para aprovação/);
  console.log(
    "PASS edição livre da capa, estilo, arraste, variáveis e PDF com a capa atualizada",
  );

  const editor = page.locator(".screenplay");
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" AJUSTE RECENTE.");
  await openMirror("Filme principal");
  const table = page.locator(".mirror-table");
  await expect(table.locator("th")).toHaveCount(5);
  await expect(table.locator("tbody tr")).toHaveCount(5);
  assert.deepEqual(
    await table
      .locator("td:first-child textarea")
      .evaluateAll((els) => els.map((el) => el.value)),
    ["1", "1", "1", "2", "3"],
  );
  assert.deepEqual(
    await table
      .locator("td:nth-child(2) textarea")
      .evaluateAll((els) => els.map((el) => el.value)),
    [
      "Primeira fala.",
      "Segunda fala.",
      "Terceira fala.",
      "A cidade acordou.",
      "",
    ],
  );
  await expect(page.getByLabel("Roteirista", { exact: true })).toHaveValue(
    "Ana Roteirista",
  );
  await expect(
    page.getByLabel("Indicação da fala · linha 1", { exact: true }),
  ).toHaveValue("LIA · Vivo\n(calmamente)");
  await expect(
    page.getByLabel("Indicação da fala · linha 4", { exact: true }),
  ).toHaveValue("Off (VO)");
  await expect(
    page.getByLabel("Lettering · linha 4", { exact: true }),
  ).toHaveValue("AMANHÃ");
  await expect(
    page.getByLabel("Descrição de cena · linha 5", { exact: true }),
  ).toHaveValue(/AJUSTE RECENTE/);
  await page
    .getByLabel("Lettering · linha 2", { exact: true })
    .fill("TEXTO AJUSTADO");
  await page
    .getByLabel("Texto falado · linha 1", { exact: true })
    .fill("Primeira fala ajustada no espelho.");
  await page
    .getByLabel("Anotações de produção", { exact: true })
    .fill("Levar a carta e testar o microfone.");
  await page.getByLabel("Revisado por", { exact: true }).fill("Beatriz");
  await saved();
  const sourceText = await page.evaluate(async ({ projectId, docId }) => {
    const { repository: r } = await import("/src/data/repository.ts");
    return JSON.stringify(
      (await r.documents(projectId)).find((d) => d.id === docId).doc,
    );
  }, seeded);
  assert.match(sourceText, /Primeira fala\./);
  assert.ok(!sourceText.includes("ajustada no espelho"));
  await page
    .getByRole("button", { name: "Voltar ao roteiro", exact: true })
    .click();
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" NOVA AÇÃO.");
  await page.getByRole("button", { name: "Mais opções", exact: true }).click();
  await page.getByRole("button", { name: "Espelho", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "O roteiro mudou" })
    .waitFor();
  await page
    .getByRole("button", { name: "Atualizar do roteiro", exact: true })
    .click();
  await expect(
    page.getByLabel("Lettering · linha 2", { exact: true }),
  ).toHaveValue("TEXTO AJUSTADO");
  await expect(
    page.getByLabel("Texto falado · linha 1", { exact: true }),
  ).toHaveValue("Primeira fala ajustada no espelho.");
  await expect(
    page.getByLabel("Descrição de cena · linha 5", { exact: true }),
  ).toHaveValue(/NOVA AÇÃO/);
  await page
    .getByRole("button", { name: "Adicionar linha", exact: true })
    .click();
  await page
    .getByLabel("Texto falado · linha 6", { exact: true })
    .fill("Uma linha manual.");
  await page
    .getByRole("button", { name: "Excluir linha 3 do espelho", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Atualizar do roteiro", exact: true })
    .click();
  await expect(table.locator("tbody tr")).toHaveCount(5);
  assert.ok(
    !(
      await table
        .locator("td:nth-child(2) textarea")
        .evaluateAll((els) => els.map((el) => el.value))
    ).includes("Terceira fala."),
  );
  await saved();
  await page.locator(".mirror-scroll").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: "artifacts/espelho-roteiro.png" });
  let mirrorPdf = await pdfInfo(
    await download(
      () =>
        page
          .getByRole("button", { name: "PDF do espelho", exact: true })
          .click(),
      "espelho-teste.pdf",
    ),
  );
  assert.match(mirrorPdf.map((p) => p.text).join(" "), /TEXTO AJUSTADO/);
  assert.match(mirrorPdf.map((p) => p.text).join(" "), /Uma linha manual/);
  const csv = (
    await download(
      () =>
        page.getByRole("button", { name: "Planilha CSV", exact: true }).click(),
      "espelho-teste.csv",
    )
  ).toString("utf8");
  assert.match(csv, /"Cena";"Texto falado"/);
  assert.match(csv, /TEXTO AJUSTADO/);
  console.log(
    "PASS espelho por fala, cenas repetidas, VO, lettering, edição independente, atualização sem perda e exportação",
  );

  // Existing saved mirrors must adopt Insert → Lettering on opening, without a manual refresh.
  await page.evaluate(async ({ projectId, docId }) => {
    const { repository: r } = await import("/src/data/repository.ts");
    const d = (await r.documents(projectId)).find((d) => d.id === docId);
    delete d.mirror.mappingVersion;
    const row = d.mirror.rows[2];
    row.lettering = row.base.lettering = "";
    row.description = row.base.description =
      'EXT. PARQUE — DIA\nINSERT "AMANHÃ"';
    await r.saveDocument(d, d.revision);
  }, seeded);
  await page.reload();
  await openProject();
  await openMirror("Filme principal");
  await expect(page.getByLabel("Revisado por", { exact: true })).toHaveValue(
    "Beatriz",
  );
  await expect(
    page.getByLabel("Lettering · linha 2", { exact: true }),
  ).toHaveValue("TEXTO AJUSTADO");
  await expect(
    page.getByLabel("Lettering · linha 3", { exact: true }),
  ).toHaveValue("AMANHÃ");
  await expect(
    page.getByLabel("Descrição de cena · linha 3", { exact: true }),
  ).not.toHaveValue(/INSERT/);
  await saved();
  const backupCheck = await page.evaluate(async ({ projectId, docId }) => {
    const { repository: r } = await import("/src/data/repository.ts");
    const { backup, parseBackup } = await import("/src/io/backup.ts");
    const project = (await r.projects(localStorage.getItem("ew.profile"))).find(
      (p) => p.id === projectId,
    );
    const d = (await r.documents(projectId)).find((d) => d.id === docId);
    const parsed = parseBackup(JSON.stringify(backup(project, [d])));
    const restoredProfile = await r.addProfile("Restauração", "");
    const restored = await r.restore(
      restoredProfile.id,
      parsed.project,
      parsed.documents,
    );
    return {
      cover: restored.cover,
      mirror: (await r.documents(restored.id))[0].mirror,
      originalCover: project.cover,
      originalMirror: d.mirror,
    };
  }, seeded);
  assert.deepEqual(backupCheck.cover, backupCheck.originalCover);
  assert.deepEqual(backupCheck.mirror, backupCheck.originalMirror);
  await openMirror("Outro roteiro");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByLabel("Roteirista", { exact: true })).toHaveValue(
    "Bruno",
  );
  await expect(page.getByLabel("Revisado por", { exact: true })).toHaveValue(
    "",
  );
  await page
    .getByRole("button", { name: "Voltar ao roteiro", exact: true })
    .click();
  pdf = await pdfInfo(await scriptPDF());
  assert.match(pdf[0].text, /ROTEIRO: Outro roteiro/);
  assert.match(pdf[0].text, /Bruno/);
  assert.ok(!pdf[0].text.includes("Filme principal"));
  const drawer2 = await nav();
  await drawer2.getByLabel("Opções de Notas", { exact: true }).click();
  assert.equal(
    await drawer2
      .locator(".doc-row")
      .filter({
        has: page.getByRole("button", { name: "Notas", exact: true }),
      })
      .getByRole("button", { name: "Espelho", exact: true })
      .count(),
    0,
  );
  await page.keyboard.press("Escape");
  await openMirror("Filme principal");
  console.log(
    "PASS persistência, backup/restauração de capa e espelho, isolamento entre roteiros e capa dinâmica",
  );

  const longFile = page.waitForEvent("download");
  await page.evaluate(async () => {
    const { mirrorPDF } = await import("/src/mirror/export.ts");
    const { blankCells, createMirror } = await import("/src/mirror/model.ts");
    const { makeManuscript } = await import("/src/model.ts");
    const data = createMirror(makeManuscript("p", "Longo"));
    data.fields.productionNotes = "Uma orientação para a equipe. ".repeat(40);
    data.rows = [
      {
        ...blankCells("7"),
        id: "long",
        spoken:
          "INICIO_LONGO " +
          "Palavra de narração. ".repeat(1000) +
          " FINAL_LONGO",
        description: "Imagem de referência. ".repeat(250),
        delivery: "Off (VO)",
      },
      ...Array.from({ length: 20 }, (_, i) => ({
        ...blankCells("8"),
        id: "row" + i,
        spoken: "FALA_CURTA_" + i,
      })),
    ];
    const pdf = await mirrorPDF("Espelho longo", data);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(pdf);
    link.download = "espelho-longo.pdf";
    link.click();
  });
  const longDownload = await longFile;
  await longDownload.saveAs("artifacts/espelho-longo.pdf");
  const longPages = await pdfInfo(
    await fs.readFile("artifacts/espelho-longo.pdf"),
  );
  assert.ok(longPages.length >= 4);
  const longText = longPages.map((p) => p.text).join(" ");
  assert.match(longText, /INICIO_LONGO/);
  assert.match(longText, /FINAL_LONGO/);
  for (let i = 0; i < 20; i++) assert.ok(longText.includes("FALA_CURTA_" + i));
  for (const p of longPages) {
    if (p.text.includes("Palavra de narração")) {
      assert.ok(p.text.includes("Texto falado"));
      assert.ok(p.items.some((item) => item.text === "7" && item.x < 70));
    }
    for (const item of p.items)
      assert.ok(
        item.x >= 35 &&
          item.x + item.width <= p.width - 34 &&
          item.y >= 19 &&
          item.y <= p.height - 30,
        "Texto do PDF deve caber na página.",
      );
  }
  console.log(
    "PASS PDF longo sem corte de falas, com cabeçalhos e cenas repetidos nas continuações",
  );

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
      true,
      "Sem overflow da página em " + width,
    );
    const bounds = await page
      .getByRole("button", { name: "PDF do espelho", exact: true })
      .boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    if (width === 390) {
      await page.locator(".mirror-scroll").evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.screenshot({ path: "artifacts/espelho-mobile.png" });
    }
  }
  assert.deepEqual(errors, []);
  console.log("PASS interface de produção responsiva de 320 a 1440px");
  await page.setViewportSize({ width: 390, height: 844 });
  const homeDrawer = await nav();
  await homeDrawer.getByRole("button", { name: /^Meus projetos/ }).click();
  await page
    .getByLabel("Opções do projeto Produção Aurora", { exact: true })
    .click();
  await page.getByRole("button", { name: "Editar capa", exact: true }).click();
  await cover.waitFor();
  assert.equal(
    await cover.evaluate((el) => el.scrollWidth <= el.clientWidth),
    true,
  );
  const originalY = await cover.getByLabel("Vertical (%)").inputValue();
  await cover.getByLabel("Vertical (%)").fill("98");
  await expect(
    cover.getByRole("button", { name: "Salvar capa", exact: true }),
  ).toBeDisabled();
  await cover.getByLabel("Vertical (%)").fill(originalY);
  await expect(
    cover.getByRole("button", { name: "Salvar capa", exact: true }),
  ).toBeEnabled();
  await cover
    .getByRole("img", { name: "Prévia da capa do roteiro" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/capa-mobile.png" });
  await page.keyboard.press("Escape");
  await cover.waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS editar capa pelo menu do projeto no celular e sinalizar texto além da página",
  );
} catch (error) {
  if (page) {
    await page.screenshot({ path: "artifacts/production-failure.png" });
    console.log((await page.locator("body").innerText()).slice(0, 1500));
  }
  throw error;
} finally {
  await browser.close();
}
