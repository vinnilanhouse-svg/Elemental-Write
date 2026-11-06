import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const zip = new JSZip();
const folder = zip.folder("Elemental-Write-Local");
await fs.access(path.join(root, "dist", "index.html"));
async function addTree(directory, prefix) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    const target = prefix + "/" + entry.name;
    if (entry.isDirectory()) await addTree(full, target);
    else if (entry.isFile())
      folder.file(target, await fs.readFile(full), {
        unixPermissions: 0o100644,
      });
  }
}
await addTree(path.join(root, "dist"), "app");
for (const entry of await fs.readdir(path.join(root, "localhost"))) {
  let bytes = await fs.readFile(path.join(root, "localhost", entry));
  if (entry.endsWith(".bat"))
    bytes = Buffer.from(bytes.toString("utf8").replace(/\r?\n/g, "\r\n"));
  folder.file(entry, bytes, {
    unixPermissions: /\.(cjs|command|sh)$/.test(entry) ? 0o100755 : 0o100644,
  });
}
await fs.mkdir(path.join(root, "releases"), { recursive: true });
const output = path.join(root, "releases", "Elemental-Write-Local.zip");
await fs.writeFile(
  output,
  await zip.generateAsync({
    type: "nodebuffer",
    platform: "UNIX",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  }),
);
console.log(`Pacote pronto: ${output}`);
