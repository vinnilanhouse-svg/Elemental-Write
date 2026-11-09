import type { Manuscript, Profile, Project } from "../model";
import { backup } from "../io/backup";
import { filename } from "../io/formats";
export type ProfileSnapshot = {
  profile: Profile;
  projects: { project: Project; documents: Manuscript[] }[];
};
export async function personalDataArchive(snapshot: ProfileSnapshot) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file(
    "perfil.json",
    JSON.stringify(
      {
        format: "elemental-write-personal-data",
        version: 1,
        exportedAt: new Date().toISOString(),
        profile: snapshot.profile,
      },
      null,
      2,
    ),
  );
  snapshot.projects.forEach(({ project, documents }, i) =>
    zip.file(
      `projetos/${String(i + 1).padStart(3, "0")}-${filename(project.title)}.json`,
      JSON.stringify(backup(project, documents), null, 2),
    ),
  );
  zip.file(
    "LEIA-ME.txt",
    "ELEMENTAL WRITE — EXPORTAÇÃO DOS SEUS DADOS\n\nperfil.json contém os dados do perfil local.\nA pasta projetos contém um backup JSON de cada projeto, incluindo roteiros, notas, capas, ícones e espelhos.\nPara restaurar os projetos, importe os arquivos JSON dessa pasta no Elemental Write. O arquivo perfil.json é uma cópia para consulta e não é importado pelo aplicativo.\nGuarde este ZIP em local seguro: ele pode conter dados pessoais e conteúdo de terceiros.\n",
  );
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
