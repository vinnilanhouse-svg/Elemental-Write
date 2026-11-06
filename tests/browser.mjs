import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const step = async (name, fn) => {
  await fn();
  console.log("PASS", name);
};
const openNavigation = async () => {
  const drawer = page.getByRole("dialog", { name: "Seus documentos" });
  if (!(await drawer.count()))
    await page.getByRole("button", { name: "Abrir navegação" }).click();
  await drawer.waitFor();
  return drawer;
};
const selectDocument = async (name) => {
  const drawer = await openNavigation();
  await drawer.getByRole("button", { name, exact: true }).click();
  await drawer.waitFor({ state: "hidden" });
};
const newDocument = async (name) => {
  const drawer = await openNavigation();
  await drawer.getByRole("button", { name, exact: true }).click();
  await page.getByRole("dialog", { name, exact: true }).waitFor();
};
const toggleTheme = async (name) => {
  await page.locator(".workspace-header").waitFor();
  const button = page.getByRole("button", { name, exact: true });
  const menu = page.getByRole("button", { name: "Mais opções" });
  await menu.click();
  await button.click();
  await page.waitForFunction(
    (theme) => document.documentElement.dataset.theme === theme,
    name.includes("claro") ? "light" : "dark",
  );
  if (await page.locator(".workspace-menu[open]").count()) await menu.click();
};
await page.goto(process.env.BASE_URL || "http://localhost:5173");
await page.screenshot({ path: "artifacts/login.png", fullPage: true });
await step("Criar perfil local", async () => {
  await page.getByLabel("Como podemos chamar você?").fill("Ana Ribeiro");
  await page.getByLabel("E-mail do perfil").fill("ana@example.com");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await page.getByRole("heading", { name: "Meus projetos" }).waitFor();
});
await page.screenshot({ path: "artifacts/dashboard.png", fullPage: true });
await step("Criar projeto", async () => {
  await page.getByRole("button", { name: "Novo projeto", exact: true }).click();
  await page
    .getByLabel("Título do projeto", { exact: true })
    .fill("O último farol");
  await page
    .getByLabel("Descrição (opcional)")
    .fill("Um roteiro sobre memória e reencontros.");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page
    .getByRole("heading", { name: "O último farol", exact: true })
    .waitFor();
});
await step("Criar roteiro e escrever com blocos estruturados", async () => {
  await page
    .getByRole("button", { name: "Criar roteiro", exact: true })
    .click();
  await page.getByLabel("Título", { exact: true }).fill("Primeiro tratamento");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.locator(".screenplay").click();
  await page.keyboard.type("INT. CASA - DIA");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Lia abre a porta.");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.type("LIA");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Você ainda se lembra?");
  await page.keyboard.press("Enter");
  assert.equal(
    await page.getByLabel("Tipo do bloco", { exact: true }).inputValue(),
    "character",
  );
  await page.keyboard.type("TOMAS");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Nunca esqueci.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("LI");
  await page.getByRole("option", { name: "LIA", exact: true }).click();
  assert.equal(
    await page.getByLabel("Tipo do bloco", { exact: true }).inputValue(),
    "character",
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page.getByLabel("Tipo do bloco", { exact: true }).inputValue(),
    "dialogue",
  );
  await page.keyboard.type("Então vamos continuar.");
  await page.getByRole("button", { name: "Salvar agora", exact: true }).click();
  await page
    .locator(".save-state")
    .filter({ hasText: /^Salvo neste navegador$/ })
    .waitFor();
});
await step("Parênteses automáticos pelo seletor e pelo Tab", async () => {
  const editor = page.locator(".screenplay");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page
    .getByLabel("Tipo do bloco", { exact: true })
    .selectOption("parenthetical");
  const last = editor.locator("p").last();
  assert.equal(await last.innerText(), "()");
  await page.keyboard.type("sussurrando");
  assert.equal(await last.innerText(), "(sussurrando)");
  await page.keyboard.press("Enter");
  assert.equal(
    await page.getByLabel("Tipo do bloco", { exact: true }).inputValue(),
    "dialogue",
  );
  await page.keyboard.type("Mais uma chance.");
  assert.equal(
    await editor.locator("p[data-kind=parenthetical]").last().innerText(),
    "(sussurrando)",
  );
  await page.keyboard.press("Tab");
  assert.equal(await last.innerText(), "(Mais uma chance.)");
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.type(" Sem perder palavras.");
  assert.equal(
    await last.innerText(),
    "(Mais uma chance. Sem perder palavras.)",
  );
  await page.getByRole("button", { name: "Salvar agora", exact: true }).click();
  await page
    .locator(".save-state")
    .filter({ hasText: /^Salvo neste navegador$/ })
    .waitFor();
});
await step(
  "Foco essencial: barra flutuante, painéis recolhíveis e teclado",
  async () => {
    assert.equal(await page.locator(".document-tabs").count(), 0);
    assert.equal(await page.getByRole("dialog").count(), 0);
    const toolbar = await page.locator(".editor-toolbar").boundingBox();
    assert.ok(toolbar.y > 850, "A barra deve flutuar na parte inferior.");
    await page.getByRole("button", { name: "Cenas", exact: true }).click();
    const scenes = page.getByRole("dialog", { name: "Cenas e personagens" });
    await scenes.waitFor();
    await scenes.locator(".outline-list>button").first().click();
    await scenes.waitFor({ state: "hidden" });
    assert.equal(
      await page.getByLabel("Tipo do bloco", { exact: true }).inputValue(),
      "scene",
    );
    const drawer = await openNavigation();
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "hidden" });
    assert.equal(
      await page
        .getByRole("button", { name: "Abrir navegação" })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.getByRole("button", { name: "Mais opções" }).click();
    await page
      .getByRole("button", { name: "Configurar página e folha de rosto" })
      .click();
    await page
      .getByRole("dialog", { name: "Página e folha de rosto" })
      .waitFor();
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await page.getByRole("button", { name: "Buscar no roteiro" }).click();
    await page.getByLabel("Texto para buscar").fill("lembra");
    await page.getByRole("button", { name: "Próxima ocorrência" }).click();
    assert.equal(await page.locator(".search-result").count(), 1);
    await page.getByRole("button", { name: "Fechar busca" }).click();
  },
);
await step(
  "Marca-texto: seleção, persistência, remoção, histórico e arquivos",
  async () => {
    const count = page.getByRole("status", {
      name: "Contador de páginas",
      exact: true,
    });
    assert.match(await count.innerText(), /1 página/);
    const initialPages = await count.innerText();
    const button = page.getByRole("button", {
      name: "Grifar texto",
      exact: true,
    });
    await button.click();
    assert.equal(await page.locator(".screenplay mark").innerText(), "lembra");
    assert.equal(await button.getAttribute("aria-pressed"), "true");
    assert.equal(await count.innerText(), initialPages);
    await page
      .getByRole("button", { name: "Salvar agora", exact: true })
      .click();
    await page
      .locator(".save-state")
      .filter({ hasText: /^Salvo neste navegador$/ })
      .waitFor();
    const files = await page.evaluate(async () => {
      const { repository } = await import("/src/data/repository.ts");
      const f = await import("/src/io/formats.ts");
      const b = await import("/src/io/backup.ts");
      const p = (
        await repository.projects(localStorage.getItem("ew.profile"))
      ).find((p) => p.title === "O último farol");
      const doc = (await repository.documents(p.id)).find(
        (d) => d.title === "Primeiro tratamento",
      );
      const hasGrifo = (d) =>
        d.doc.content.some((block) =>
          (block.content || []).some((span) =>
            span.marks?.some((mark) => mark.type === "highlight"),
          ),
        );
      const json = b.parseBackup(JSON.stringify(b.backup(p, [doc])));
      const docx = await f.docxExport(doc);
      const imported = await f.parseDOCX(new File([docx], "grifo.docx"));
      const pdf = await f.pdfExport(doc);
      await f.parsePDF(new File([pdf], "grifo.pdf"));
      const pdfjs = await import("/node_modules/pdfjs-dist/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc =
        "/node_modules/pdfjs-dist/build/pdf.worker.min.mjs";
      const document = await pdfjs.getDocument({
        data: new Uint8Array(await pdf.arrayBuffer()),
        useSystemFonts: true,
      }).promise;
      let yellow = 0;
      try {
        const pdfPage = await document.getPage(1);
        const viewport = pdfPage.getViewport({ scale: 1 });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        await pdfPage.render({ canvasContext: ctx, canvas, viewport }).promise;
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 0; i < pixels.length; i += 4)
          if (
            pixels[i] === 255 &&
            pixels[i + 1] === 235 &&
            pixels[i + 2] === 130
          )
            yellow++;
      } finally {
        await document.destroy();
      }
      return {
        json: hasGrifo(json.documents[0]),
        docx: hasGrifo({ doc: imported.doc }),
        yellow,
      };
    });
    assert.equal(files.json, true);
    assert.equal(files.docx, true);
    assert.ok(files.yellow > 20, "O PDF deve conter o fundo amarelo real.");
    await page.reload();
    await page.getByRole("heading", { name: "Meus projetos" }).waitFor();
    await page
      .getByRole("button", { name: /O último farol Um roteiro/ })
      .click();
    await page.locator(".screenplay mark").waitFor();
    assert.equal(await page.locator(".screenplay mark").innerText(), "lembra");
    await page.screenshot({ path: "artifacts/grifo.png" });
    await page.getByRole("button", { name: "Buscar no roteiro" }).click();
    await page.getByLabel("Texto para buscar").fill("lembra");
    await page.getByRole("button", { name: "Próxima ocorrência" }).click();
    await page.getByRole("button", { name: "Fechar busca" }).click();
    await button.click();
    assert.equal(await page.locator(".screenplay mark").count(), 0);
    await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    assert.equal(await page.locator(".screenplay mark").innerText(), "lembra");
    await page.getByRole("button", { name: "Refazer", exact: true }).click();
    assert.equal(await page.locator(".screenplay mark").count(), 0);
    await page
      .getByRole("button", { name: "Salvar agora", exact: true })
      .click();
    await page
      .locator(".save-state")
      .filter({ hasText: /^Salvo neste navegador$/ })
      .waitFor();
  },
);
await page.screenshot({ path: "artifacts/editor.png", fullPage: true });
await step(
  "Segundo roteiro e nota; alternância sem misturar texto",
  async () => {
    await newDocument("Novo roteiro");
    await page.getByLabel("Título", { exact: true }).fill("Segundo tratamento");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.locator(".screenplay").click();
    await page.keyboard.type("EXT. PRAIA - NOITE");
    await page.keyboard.press("Enter");
    await page.keyboard.type("As ondas chegam.");
    await newDocument("Nova nota");
    await page
      .getByLabel("Título", { exact: true })
      .fill("Referências visuais");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.getByLabel("Corpo da nota").fill("Luz do farol. Memória e mar.");
    await selectDocument("Primeiro tratamento");
    assert.ok(
      (await page.locator(".screenplay").innerText()).includes(
        "Você ainda se lembra?",
      ),
    );
    assert.ok(
      !(await page.locator(".screenplay").innerText()).includes(
        "As ondas chegam.",
      ),
    );
  },
);
await step("Recarregar e restaurar perfil, projeto e textos", async () => {
  await page.reload();
  await page.getByRole("heading", { name: "Meus projetos" }).waitFor();
  await page.getByRole("button", { name: /O último farol Um roteiro/ }).click();
  await page
    .getByRole("heading", { name: "Primeiro tratamento", exact: true })
    .waitFor();
  assert.ok(
    (await page.locator(".screenplay").innerText()).includes(
      "Então vamos continuar.",
    ),
  );
  await selectDocument("Referências visuais");
  assert.equal(
    await page.getByLabel("Corpo da nota").inputValue(),
    "Luz do farol. Memória e mar.",
  );
});
await step("Tema persistido por perfil", async () => {
  await toggleTheme("Ativar tema claro");
  await page.reload();
  await page.getByRole("heading", { name: "Meus projetos" }).waitFor();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.getByRole("button", { name: /O último farol Um roteiro/ }).click();
  await toggleTheme("Ativar tema escuro");
});
await step("Isolamento entre perfis", async () => {
  await selectDocument("Sair do perfil");
  await page.getByRole("button", { name: "Criar outro perfil" }).click();
  await page.getByLabel("Como podemos chamar você?").fill("Bruno");
  await page.getByLabel("E-mail do perfil").fill("bruno@example.com");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await page.getByRole("heading", { name: "Meus projetos" }).waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "O último farol", exact: true })
      .count(),
    0,
  );
  await selectDocument("Sair do perfil");
  await page
    .getByRole("button", { name: /Ana Ribeiro ana@example.com/ })
    .click();
  await page.getByRole("button", { name: /O último farol Um roteiro/ }).click();
});
await step(
  "Exportações e reimportações reais PDF/DOCX/FDX/Fountain; backup completo",
  async () => {
    const result = await page.evaluate(async () => {
      const f = await import("/src/io/formats.ts");
      const m = await import("/src/model.ts");
      const { repository } = await import("/src/data/repository.ts");
      const p = (
        await repository.projects(localStorage.getItem("ew.profile"))
      ).find((p) => p.title === "O último farol");
      const docs = await repository.documents(p.id);
      const script = docs.find((d) => d.title === "Primeiro tratamento");
      script.titlePage = true;
      script.author = "Ana — coração e ação";
      script.doc.content.push({
        type: "block",
        attrs: { kind: "action" },
        content: [
          {
            type: "text",
            text: "Ação, coração, memória e você.",
            marks: [
              { type: "bold" },
              { type: "italic" },
              { type: "underline" },
            ],
          },
        ],
      });
      const docx = await f.docxExport(script);
      const parsedDocx = await f.parseDOCX(new File([docx], "roteiro.docx"));
      const fdx = f.fdxExport(script);
      const parsedFDX = f.parseFDX(fdx);
      const fountain = f.fountainExport(script);
      const parsedFountain = f.parseFountain(fountain);
      const pdf = await f.pdfExport(script);
      const parsedPDF = await f.parsePDF(new File([pdf], "roteiro.pdf"));
      const b = await import("/src/io/backup.ts");
      const saved = b.parseBackup(JSON.stringify(b.backup(p, docs)));
      return {
        docxSize: docx.size,
        pdfSize: pdf.size,
        pdf: parsedPDF.doc.content.map(m.textOf).join("\n"),
        docx: parsedDocx.doc.content.map(m.textOf).join("\n"),
        fdx: parsedFDX.doc,
        fountain: parsedFountain.doc,
        original: script.doc,
        backupCount: saved.documents.length,
        backupNote: saved.documents.find((d) => d.kind === "note").body,
      };
    });
    assert.ok(result.docxSize > 5000);
    assert.ok(result.pdfSize > 10000);
    assert.match(result.pdf, /coração/);
    assert.match(result.docx, /memória e você/);
    assert.deepEqual(result.fdx, result.original);
    assert.deepEqual(result.fountain, result.original);
    assert.equal(result.backupCount, 3);
    assert.equal(result.backupNote, "Luz do farol. Memória e mar.");
  },
);
await step("Downloads da interface e restauração por arquivo", async () => {
  await selectDocument("Primeiro tratamento");
  await page.getByText("Exportar", { exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Backup do projeto inteiro" }).click();
  const d = await pending;
  await d.saveAs("artifacts/projeto.json");
  const b = JSON.parse(await fs.readFile("artifacts/projeto.json", "utf8"));
  assert.equal(b.documents.length, 3);
  await page
    .locator("input[type=file]")
    .setInputFiles("artifacts/projeto.json");
  await page
    .getByRole("button", { name: "Restaurar projeto", exact: true })
    .click();
  await page
    .getByText("Backup restaurado em um novo projeto.", { exact: true })
    .waitFor();
});
await step("Exportar e importar cada formato pela interface", async () => {
  for (const ext of ["fountain", "fdx", "docx", "pdf"]) {
    await page.getByText("Exportar", { exact: true }).click();
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: ext.toUpperCase(), exact: true })
      .click();
    const file = await pending;
    const target = "artifacts/exportado." + ext;
    await file.saveAs(target);
    assert.ok((await fs.stat(target)).size > 20);
    await page.locator("input[type=file]").setInputFiles(target);
    const dialog = page.getByRole("dialog", { name: "Revisar importação" });
    await dialog.waitFor();
    await dialog
      .getByLabel("Título do novo roteiro")
      .fill("Importado " + ext.toUpperCase());
    await dialog
      .getByRole("button", { name: "Importar roteiro", exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: "Importado " + ext.toUpperCase(),
        exact: true,
      })
      .waitFor();
    assert.ok(
      (await page.locator(".screenplay").innerText()).includes(
        "Você ainda se lembra?",
      ),
    );
  }
});
await step("Edição durante salvamento lento não é perdida", async () => {
  await page.evaluate(async () => {
    const { repository } = await import("/src/data/repository.ts");
    window.originalSave = repository.saveDocument.bind(repository);
    let delayFirstSave = true;
    window.releaseDelayedSave = null;
    repository.saveDocument = async (...args) => {
      if (delayFirstSave) {
        delayFirstSave = false;
        await new Promise((resolve) => {
          window.releaseDelayedSave = resolve;
        });
      }
      return window.originalSave(...args);
    };
  });
  await page.locator(".screenplay").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Primeira edição.");
  await page.waitForFunction(
    () => typeof window.releaseDelayedSave === "function",
  );
  assert.equal(
    (await page.locator(".save-state").innerText()).trim(),
    "Salvando…",
  );
  await page.keyboard.type(" Edição mais recente.");
  await page.evaluate(() => window.releaseDelayedSave());
  await page
    .locator(".save-state")
    .filter({ hasText: /^Salvo neste navegador$/ })
    .waitFor();
  const text = await page.evaluate(async () => {
    const { repository } = await import("/src/data/repository.ts");
    repository.saveDocument = window.originalSave;
    const { textOf } = await import("/src/model.ts");
    for (const p of await repository.projects(
      localStorage.getItem("ew.profile"),
    )) {
      const doc = (await repository.documents(p.id)).find(
        (d) => d.title === "Importado PDF",
      );
      if (doc) return doc.doc.content.map(textOf).join(" ");
    }
  });
  assert.match(text, /Primeira edição. Edição mais recente./);
});
await step(
  "Falha de gravação preserva texto e permite nova tentativa",
  async () => {
    await page.evaluate(async () => {
      const { repository } = await import("/src/data/repository.ts");
      window.originalSave = repository.saveDocument.bind(repository);
      repository.saveDocument = async () => {
        throw new Error("Espaço insuficiente no navegador (teste).");
      };
    });
    await page.locator(".screenplay").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" Texto protegido.");
    await page.getByRole("alert").waitFor();
    assert.match(
      await page.locator(".screenplay").innerText(),
      /Texto protegido/,
    );
    await page.evaluate(async () => {
      const { repository } = await import("/src/data/repository.ts");
      repository.saveDocument = window.originalSave;
    });
    await page
      .getByRole("button", { name: "Tentar salvar", exact: true })
      .click();
    await page
      .locator(".save-state")
      .filter({ hasText: /^Salvo neste navegador$/ })
      .waitFor();
  },
);
await step("Roteiro de várias páginas no editor e no PDF", async () => {
  await page.evaluate(async () => {
    const { repository } = await import("/src/data/repository.ts");
    const { makeManuscript, block } = await import("/src/model.ts");
    const projects = await repository.projects(
      localStorage.getItem("ew.profile"),
    );
    const p = projects.find((p) => p.title.includes("(restaurado)"));
    const d = makeManuscript(p.id, "Teste de paginação");
    d.doc = {
      type: "doc",
      content: [
        block("scene", "INT. SALA - DIA"),
        ...Array.from({ length: 22 }, () =>
          block("action", "Uma ação breve para preencher a página."),
        ),
        block("character", "LIA"),
        block("parenthetical", "(calmamente)"),
        block(
          "dialogue",
          "Todas as palavras precisam continuar na página seguinte. ".repeat(
            150,
          ),
        ),
        block("scene", "EXT. JARDIM - DIA"),
        block("action", "Fim do teste."),
      ],
    };
    await repository.createDocument(d);
  });
  await page.reload();
  await page.getByRole("heading", { name: "Meus projetos" }).waitFor();
  await page
    .getByRole("button", { name: /O último farol \(restaurado\) Um roteiro/ })
    .click();
  await selectDocument("Teste de paginação");
  await page
    .getByRole("heading", { name: "Teste de paginação", exact: true })
    .waitFor();
  const result = await page.evaluate(async () => {
    const { repository } = await import("/src/data/repository.ts");
    const { layout } = await import("/src/editor/layout.ts");
    const { pdfExport, parsePDF } = await import("/src/io/formats.ts");
    const { textOf } = await import("/src/model.ts");
    const projects = await repository.projects(
      localStorage.getItem("ew.profile"),
    );
    const p = projects.find((p) => p.title.includes("(restaurado)"));
    const doc = (await repository.documents(p.id)).find(
      (d) => d.title === "Teste de paginação",
    );
    const plan = layout(doc.doc.content, doc.paper);
    const pdf = await pdfExport(doc);
    const parsed = await parsePDF(new File([pdf], "longo.pdf"));
    const paper = document.querySelector(".paper");
    const character = document.querySelector("p[data-kind=character]");
    const speech = document.querySelector("p[data-kind=dialogue]");
    const factor = Number(paper.style.zoom);
    const actualPage = (el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const text = walker.nextNode();
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, 1);
      return (
        Math.floor(
          (((range.getBoundingClientRect().top -
            paper.getBoundingClientRect().top) /
            factor) *
            0.75) /
            (plan.geometry.height + 18),
        ) + 1
      );
    };
    return {
      pages: plan.pages,
      breaks: document.querySelectorAll(".page-break").length,
      charPage: actualPage(character),
      speechPage: actualPage(speech),
      expectedCharPage: plan.lines.find((l) => l.kind === "character").page,
      pdfText: parsed.doc.content.map(textOf).join(" "),
    };
  });
  assert.ok(result.pages >= 4);
  const counter = page.getByRole("status", {
    name: "Contador de páginas",
    exact: true,
  });
  assert.equal((await counter.innerText()).trim(), `${result.pages} páginas`);
  const counterBounds = await counter.boundingBox();
  assert.ok(counterBounds.x > 1100 && counterBounds.y > 900);
  assert.equal(result.breaks, result.pages - 1);
  assert.equal(result.charPage, result.speechPage);
  assert.equal(result.charPage, result.expectedCharPage);
  assert.match(result.pdfText, /Fim do teste/);
  await page.screenshot({ path: "artifacts/multiplas-paginas.png" });
  await page.locator(".screenplay").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Uma página apenas.");
  await counter.filter({ hasText: /^1 página$/ }).waitFor();
  await selectDocument("Importado PDF");
});
await step("Mobile sem perda de controles", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir navegação" }).click();
  await page.getByRole("button", { name: "Fechar painel" }).click();
  await page
    .getByRole("dialog", { name: "Seus documentos" })
    .waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Alternar modo foco" })
    .scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Alternar modo foco" }).click();
  await page.getByRole("button", { name: "Alternar modo foco" }).click();
  assert.equal(
    await page
      .locator(".editor-toolbar")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
    true,
  );
  assert.equal(
    await page
      .getByRole("status", { name: "Salvo neste navegador", exact: true })
      .isVisible(),
    true,
  );
  const fontSize = await page
    .locator(".screenplay")
    .evaluate((el) => getComputedStyle(el).fontSize);
  await page.getByLabel("Zoom da página").selectOption("100");
  assert.notEqual(
    await page
      .locator(".screenplay")
      .evaluate((el) => getComputedStyle(el).fontSize),
    fontSize,
  );
  assert.equal(
    await page
      .getByRole("status", { name: "Contador de páginas", exact: true })
      .isVisible(),
    true,
  );
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  assert.equal(
    await page
      .locator("body")
      .evaluate((el) => el.scrollWidth <= window.innerWidth),
    true,
  );
});
await step(
  "Conflito entre duas abas é detectado sem apagar texto",
  async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const second = await context.newPage();
    await second.goto(process.env.BASE_URL || "http://localhost:5173");
    await second.getByRole("heading", { name: "Meus projetos" }).waitFor();
    await second.evaluate(async () => {
      const { repository } = await import("/src/data/repository.ts");
      for (const p of await repository.projects(
        localStorage.getItem("ew.profile"),
      )) {
        const doc = (await repository.documents(p.id)).find(
          (d) => d.title === "Importado PDF",
        );
        if (doc) {
          await repository.saveDocument(
            { ...doc, author: "Outra aba" },
            doc.revision,
          );
          return;
        }
      }
      throw Error("Documento de teste não encontrado");
    });
    await page.locator(".screenplay").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" Texto exclusivo desta aba.");
    await page.getByRole("alert").waitFor();
    assert.match(await page.getByRole("alert").innerText(), /outra aba/);
    assert.match(
      await page.locator(".screenplay").innerText(),
      /Texto exclusivo desta aba/,
    );
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Exportar texto atual", exact: true })
      .click();
    const file = await pending;
    await file.saveAs("artifacts/conflito.json");
    assert.match(
      await fs.readFile("artifacts/conflito.json", "utf8"),
      /Texto exclusivo desta aba/,
    );
    await second.close();
  },
);
assert.deepEqual(errors, []);
console.log("Todos os fluxos de navegador passaram.");
await browser.close();
