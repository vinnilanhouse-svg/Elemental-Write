// Dev-only harness used by tests/autosave.mjs; not imported by the application.
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { useDocument } from "../src/data/useDocument";
import { repository } from "../src/data/repository";
import { makeManuscript, block, type Manuscript } from "../src/model";
let root: Root | null = null;
let session: ReturnType<typeof useDocument> | null = null;
let initial: Manuscript;
function Harness() {
  session = useDocument(initial, () => {});
  return null;
}
export async function mount() {
  const project = await repository.createProject(
    "autosave-test",
    "Teste de autosave",
  );
  initial = makeManuscript(project.id, "Roteiro em edição contínua");
  await repository.createDocument(initial);
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  flushSync(() => root!.render(<Harness />));
}
export function change(text: string) {
  flushSync(() =>
    session!.change({ doc: { type: "doc", content: [block("action", text)] } }),
  );
}
export async function snapshot() {
  return (await repository.documents(initial.projectId)).find(
    (d) => d.id === initial.id,
  )!;
}
export function unmount() {
  flushSync(() => root!.unmount());
  root = null;
  session = null;
}
