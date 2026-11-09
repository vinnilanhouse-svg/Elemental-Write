#!/usr/bin/env node
// Servidor local sem dependências. Não publica o aplicativo na rede.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const securityHeaders = require("./security-headers.json");
const root = path.resolve(__dirname, "app");
const port = 5173;
const address = `http://localhost:${port}`;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};
if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error(
    "A pasta app não foi encontrada. Extraia o ZIP inteiro antes de iniciar.",
  );
  process.exit(1);
}
const server = http.createServer((req, res) => {
  for (const [key, value] of Object.entries(securityHeaders))
    res.setHeader(key, value);
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  let file;
  try {
    const pathname = decodeURIComponent(new URL(req.url, address).pathname);
    file = path.resolve(root, "." + pathname);
    const relative = path.relative(root, file);
    if (
      relative.startsWith("..") ||
      path.isAbsolute(relative) ||
      pathname.includes("\0")
    ) {
      res.writeHead(403).end("Acesso negado.");
      return;
    }
    if (pathname === "/") file = path.join(root, "index.html");
  } catch {
    res.writeHead(400).end("Endereço inválido.");
    return;
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      res
        .writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
        .end("Arquivo não encontrado.");
      return;
    }
    res.writeHead(200, {
      "Content-Type":
        types[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    const stream = fs.createReadStream(file);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  });
});
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? "A porta 5173 já está em uso. Se o Elemental Write já estiver aberto, acesse " +
          address +
          ". Caso contrário, feche o programa que ocupa essa porta e tente de novo."
      : "Não foi possível iniciar: " + error.message,
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(
    "\n  ELEMENTAL WRITE — versão localhost\n\n  Abra " +
      address +
      " no navegador.\n  Mantenha esta janela aberta. Ctrl+C encerra o aplicativo.\n  Seus textos ficam neste navegador. Faça backups JSON.\n",
  );
  if (!process.argv.includes("--no-open")) {
    const command =
      process.platform === "win32"
        ? "cmd"
        : process.platform === "darwin"
          ? "open"
          : "xdg-open";
    const args =
      process.platform === "win32" ? ["/c", "start", "", address] : [address];
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.on("error", () => console.log("Abra manualmente " + address));
    child.unref();
  }
});
process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
