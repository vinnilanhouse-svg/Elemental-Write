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
try {
  await fs.mkdir("artifacts", { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://localhost:5174");
  await page.evaluate(async () => {
    const { repository: r } = await import("/src/data/repository.ts");
    const { makeManuscript, block } = await import("/src/model.ts");
    const profile = await r.addProfile("Teste", "teste@example.com");
    const project = await r.createProject(profile.id, "Planos e cenas");
    const script = makeManuscript(project.id, "Roteiro técnico");
    script.doc = {
      type: "doc",
      content: [
        block(
          "scene",
          "INT. BRUNO EM 45 GRAUS FALANDO COM UM MICROFONE NA FRENTE COMO SE FOSSE UM PODCAST",
        ),
        {
          type: "block",
          attrs: { kind: "action" },
          content: Array.from({ length: 41 }, (_, i) => [
            ...(i ? [{ type: "hard_break" }] : []),
            { type: "text", text: "A luz acompanha cada movimento." },
          ]).flat(),
        },
        block("scene", "EXT. JARDIM — DIA"),
        block("action", "Lia observa o horizonte."),
        block("scene", "INT. CASA — NOITE"),
        block("action"),
      ],
    };
    await r.createDocument(script);
    localStorage.setItem("ew.profile", profile.id);
    window.projectId = project.id;
  });
  await page.reload();
  await page.getByRole("heading", { name: "Meus projetos" }).waitFor();
  await page
    .getByRole("button", { name: /Planos e cenas Uma nova história/ })
    .click();
  const editor = page.locator(".screenplay");
  const type = page.getByLabel("Tipo do bloco", { exact: true });
  await editor.waitFor();
  await page.evaluate(() => document.fonts.ready);
  await expect(editor.locator(".scene-number")).toHaveText(["1", "2", "3"]);
  const metrics = await editor
    .locator("p[data-kind=scene]")
    .evaluateAll((headings) =>
      headings.map((p) => {
        const text = [...p.childNodes].find(
          (n) => n.nodeType === Node.TEXT_NODE,
        );
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, 1);
        const first = range.getBoundingClientRect();
        const badge = p.querySelector(".scene-number").getBoundingClientRect();
        const paragraph = p.getBoundingClientRect();
        return {
          difference: Math.abs(first.top - badge.top),
          rightGap: badge.left - paragraph.right,
          height: paragraph.height,
          hasBreak: !!p.querySelector(".page-break"),
        };
      }),
    );
  console.log("Scene positions", metrics);
  assert.ok(
    metrics[0].height > 30,
    "O cabeçalho longo precisa ocupar duas linhas.",
  );
  assert.ok(
    metrics[1].hasBreak,
    "O segundo cabeçalho deve iniciar a página seguinte.",
  );
  for (const metric of metrics) {
    assert.ok(
      metric.difference < 5,
      "O número deve acompanhar a primeira linha, mesmo após quebra de página.",
    );
    assert.ok(
      metric.rightGap >= 0,
      "O número deve ficar à direita sem cobrir o texto.",
    );
  }
  await page.screenshot({ path: "artifacts/cenas-numeradas.png" });
  // Convert the last scene and undo: numbering remains derived from scene order.
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("ArrowUp");
  await expect(type).toHaveValue("scene");
  await type.selectOption("character");
  await expect(editor.locator(".scene-number")).toHaveText(["1", "2"]);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(editor.locator(".scene-number")).toHaveText(["1", "2", "3"]);
  console.log(
    "PASS numeração automática, cabeçalho longo, quebra de página e desfazer",
  );

  await editor.focus();
  await page.keyboard.press("Control+End");
  await expect(type).toHaveValue("action");
  await type.selectOption("shot");
  const chooser = page.getByRole("listbox", { name: "Planos", exact: true });
  await expect(chooser.getByRole("option")).toHaveCount(9);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: "artifacts/lista-planos.png" });
  await page.keyboard.press("Escape");
  await expect(type).toHaveValue("action");
  assert.equal((await editor.locator("p").last().innerText()).trim(), "");
  await type.selectOption("shot");
  await page.getByRole("button", { name: "Salvar agora", exact: true }).click();
  await expect(chooser).toHaveCount(0);
  await expect(type).toHaveValue("action");
  await type.selectOption("shot");
  await page
    .getByRole("option", { name: "PM Plano médio", exact: true })
    .click();
  await expect(type).toHaveValue("shot");
  await page.keyboard.type("Lia segura a carta.");
  await expect(editor.locator("p").last()).toHaveText(
    "PLANO MÉDIO — Lia segura a carta.",
  );
  await page
    .getByRole("button", { name: "Escolher plano", exact: true })
    .click();
  await expect(
    chooser.getByRole("option", { name: "PM Plano médio", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(chooser).toHaveCount(0);
  await expect(editor.locator("p").last()).toHaveText(
    "PRIMEIRO PLANO — Lia segura a carta.",
  );
  await page
    .getByRole("button", { name: "Guia de planos", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Guia de planos", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Usar primeiro plano", exact: true })
    .click();
  await expect(editor.locator("p").last()).toHaveText(
    "PRIMEIRO PLANO — Lia segura a carta.",
  );
  await page.keyboard.press("Enter");
  await expect(type).toHaveValue("action");
  await type.selectOption("insert");
  await expect(editor.locator("p").last()).toHaveText("INSERT ");
  await page.keyboard.type("O relógio marca meia-noite.");
  await expect(editor.locator("p").last()).toHaveText(
    "INSERT O relógio marca meia-noite.",
  );
  await page.keyboard.press("Shift+Tab");
  await chooser.waitFor();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(type).toHaveValue("insert");
  await expect(editor.locator("p").last()).toHaveText(
    "INSERT O relógio marca meia-noite.",
  );
  await page.keyboard.press("Enter");
  await expect(type).toHaveValue("action");
  // Keyboard access to the shot picker also waits for a choice before changing the block.
  await type.selectOption("transition");
  await page.keyboard.press("Tab");
  await chooser.waitFor();
  await page
    .getByRole("option", { name: "PD Plano detalhe", exact: true })
    .click();
  await expect(editor.locator("p").last()).toHaveText("PLANO DETALHE — ");
  await page.keyboard.type("A chave na mesa.");
  await page.keyboard.press("Enter");
  await type.selectOption("shot");
  await page
    .getByRole("option", { name: "VO Voice Over (VO)", exact: true })
    .click();
  await expect(type).toHaveValue("shot");
  await page.keyboard.type("Uma lembrança distante.");
  await expect(editor.locator("p").last()).toHaveText(
    "VOICE OVER (VO) — Uma lembrança distante.",
  );
  await page.getByRole("button", { name: "Salvar agora", exact: true }).click();
  await page
    .getByRole("status", { name: "Salvo neste navegador", exact: true })
    .waitFor();
  const exports = await page.evaluate(async () => {
    const { repository: r } = await import("/src/data/repository.ts");
    const f = await import("/src/io/formats.ts");
    const { backup, parseBackup } = await import("/src/io/backup.ts");
    const projects = await r.projects(localStorage.getItem("ew.profile"));
    const project = projects.find((p) => p.title === "Planos e cenas");
    const doc = (await r.documents(project.id))[0];
    const docx = await f.docxExport(doc);
    const parsedDocx = await f.parseDOCX(new File([docx], "planos.docx"));
    const pdf = await f.pdfExport(doc);
    const parsedPDF = await f.parsePDF(new File([pdf], "planos.pdf"));
    const { textOf } = await import("/src/model.ts");
    const source = doc.doc.content.filter((b) =>
      ["shot", "insert"].includes(b.attrs.kind),
    );
    const expected = source.map((b) => ({
      kind: b.attrs.kind,
      text: textOf(b).toLocaleUpperCase("pt-BR"),
    }));
    const tech = (doc) =>
      doc.content
        .filter((b) => ["shot", "insert"].includes(b.attrs.kind))
        .map((b) => ({ kind: b.attrs.kind, text: textOf(b) }));
    return {
      expected,
      fdx: tech(f.parseFDX(f.fdxExport(doc)).doc),
      fountain: tech(f.parseFountain(f.fountainExport(doc)).doc),
      docx: tech(parsedDocx.doc),
      backup: parseBackup(JSON.stringify(backup(project, [doc]))).documents[0]
        .doc,
      source: doc.doc,
      pdf: parsedPDF.doc.content.map(textOf).join(" "),
    };
  });
  for (const format of ["fdx", "fountain", "docx"])
    assert.deepEqual(exports[format], exports.expected, format);
  assert.deepEqual(exports.backup, exports.source);
  assert.ok(
    exports.source.content
      .filter((b) => b.attrs.kind === "scene")
      .every((b) => !/^[123]/.test(b.content[0].text)),
  );
  assert.match(exports.pdf, /PRIMEIRO PLANO/);
  assert.match(exports.pdf, /INSERT O RELÓGIO/);
  console.log(
    "PASS Plano, Voice Over, Insert, teclado, cancelamento e exportações PDF/DOCX/FDX/Fountain/JSON",
  );

  await editor.focus();
  await page.keyboard.press("Control+End");
  await expect(type).toHaveValue("shot");
  await page.keyboard.press("Enter");
  await expect(type).toHaveValue("action");
  await page
    .getByRole("button", { name: "Guia de planos", exact: true })
    .click();
  const guide = page.getByRole("dialog", {
    name: "Guia de planos",
    exact: true,
  });
  await expect(guide.getByRole("img", { name: /^Ilustração:/ })).toHaveCount(9);
  assert.equal(
    await page.evaluate(async () => {
      const img = new Image();
      img.src = "/shot-guide.png";
      await img.decode();
      return img.naturalWidth;
    }),
    1672,
  );
  await page.screenshot({ path: "artifacts/guia-planos.png" });
  await page.keyboard.press("Escape");
  for (const width of [1440, 1100, 1024, 900, 800, 768, 600, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page
        .locator(".editor-toolbar")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
      `Barra sem overflow em ${width}px`,
    );
    const camera = await page
      .getByRole("button", { name: "Guia de planos", exact: true })
      .boundingBox();
    assert.ok(
      camera.x >= 0 && camera.x + camera.width <= width,
      `Câmera visível em ${width}px`,
    );
    const counter = await page
      .getByRole("status", { name: "Contador de páginas", exact: true })
      .boundingBox();
    const dock = await page.locator(".editor-toolbar").boundingBox();
    const overlap =
      Math.min(dock.x + dock.width, counter.x + counter.width) >
        Math.max(dock.x, counter.x) &&
      Math.min(dock.y + dock.height, counter.y + counter.height) >
        Math.max(dock.y, counter.y);
    assert.equal(overlap, false, `Contador livre da barra em ${width}px`);
    const number = await editor.locator(".scene-number").first().boundingBox();
    const paper = await page.locator(".paper").boundingBox();
    assert.ok(
      number.x >= paper.x && number.x + number.width <= paper.x + paper.width,
      `Número de cena dentro da folha em ${width}px`,
    );
    // Larger viewports retain real page dimensions and can scroll at high zoom.
    if (width <= 600)
      assert.ok(
        number.x >= 0 && number.x + number.width <= width,
        `Número de cena visível no celular em ${width}px`,
      );
    if (width === 390) {
      await page
        .getByRole("button", { name: "Guia de planos", exact: true })
        .click();
      await guide.waitFor();
      assert.equal(
        await guide.evaluate((el) => el.scrollWidth <= el.clientWidth),
        true,
      );
      await page.screenshot({ path: "artifacts/guia-planos-mobile.png" });
      await page.keyboard.press("Escape");
    }
    await type.selectOption("shot");
    await chooser.waitFor();
    const listBounds = await chooser.boundingBox();
    assert.ok(
      listBounds.x >= 0 &&
        listBounds.y >= 0 &&
        listBounds.x + listBounds.width <= width &&
        listBounds.y + listBounds.height <= 1000,
      `Lista de planos dentro da tela em ${width}px`,
    );
    assert.equal(
      await page
        .locator(".editor-toolbar")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
      `Barra com seletor de plano em ${width}px`,
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (width === 390)
      await page.screenshot({ path: "artifacts/lista-planos-mobile.png" });
    await page.keyboard.press("Escape");
  }
  console.log("PASS guia ilustrado e controles responsivos de 320 a 1440px");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Salvar agora", exact: true }).click();
  await page
    .getByRole("status", { name: "Salvo neste navegador", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: /Planos e cenas Uma nova história/ })
    .click();
  await expect(editor.locator(".scene-number")).toHaveText(["1", "2", "3"]);
  await expect(editor.locator("p[data-kind=shot]")).toHaveCount(3);
  await expect(editor.locator("p[data-kind=shot]").last()).toHaveText(
    "VOICE OVER (VO) — Uma lembrança distante.",
  );
  await expect(editor.locator("p[data-kind=insert]")).toHaveText(
    "INSERT O relógio marca meia-noite.",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS recarregamento preserva os novos blocos e recalcula os números",
  );
} finally {
  await browser.close();
}
