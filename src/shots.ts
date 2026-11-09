export const shots = [
  {
    id: "gpg",
    name: "Grande plano geral",
    short: "GPG",
    description:
      "Apresenta a paisagem e situa a ação. A pessoa aparece pequena no ambiente.",
  },
  {
    id: "pg",
    name: "Plano geral",
    short: "PG",
    description: "Mostra o corpo inteiro e sua relação com o espaço ao redor.",
  },
  {
    id: "pc",
    name: "Plano de conjunto",
    short: "PC",
    description: "Enquadra um grupo e evidencia a relação entre as pessoas.",
  },
  {
    id: "pa",
    name: "Plano americano",
    short: "PA",
    description: "Enquadra da cabeça até aproximadamente os joelhos.",
  },
  {
    id: "pm",
    name: "Plano médio",
    short: "PM",
    description:
      "Enquadra da cintura para cima, destacando gestos e expressão.",
  },
  {
    id: "pp",
    name: "Primeiro plano",
    short: "PP",
    description: "Mostra cabeça e ombros, aproximando o olhar da expressão.",
  },
  {
    id: "ppp",
    name: "Primeiríssimo plano",
    short: "PPP",
    description: "Fecha no rosto para evidenciar uma emoção ou reação.",
  },
  {
    id: "pd",
    name: "Plano detalhe",
    short: "PD",
    description:
      "Destaca uma parte do corpo, um objeto ou um detalhe importante.",
  },
  {
    id: "vo",
    name: "Voice Over (VO)",
    short: "VO",
    description:
      "Narração ou fala ouvida sobre a imagem, sem mostrar quem está falando.",
  },
] as const;
export type ShotId = (typeof shots)[number]["id"];

// Recognize only complete generated prefixes, leaving the writer's description intact.
export function shotPrefix(text: string) {
  const upper = text.toLocaleUpperCase("pt-BR");
  for (const shot of shots) {
    const names =
      shot.id === "vo" ? [shot.name, "Voice Over", "VO"] : [shot.name];
    for (const name of names) {
      if (!upper.startsWith(name.toLocaleUpperCase("pt-BR"))) continue;
      const separator = text.slice(name.length).match(/^(?:\s*[—:-]\s*|$)/);
      if (separator) return text.slice(0, name.length + separator[0].length);
    }
  }
  return "";
}
export const insertPrefix = (text: string) =>
  text.match(/^INSERT\b[:—-]?[ \t]*/i)?.[0] || "";
export const technicalKind = (text: string) =>
  insertPrefix(text) ? "insert" : shotPrefix(text) ? "shot" : "action";
