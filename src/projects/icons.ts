export const projectIcons = [
  { id: "clapperboard", label: "Claquete" },
  { id: "film", label: "Película" },
  { id: "video", label: "Câmera de vídeo" },
  { id: "camera", label: "Câmera fotográfica" },
  { id: "screen", label: "Tela de cinema" },
  { id: "mic", label: "Microfone" },
  { id: "podcast", label: "Podcast" },
  { id: "headphones", label: "Fones de ouvido" },
  { id: "music", label: "Música" },
  { id: "megaphone", label: "Megafone" },
  { id: "pen", label: "Caneta" },
  { id: "feather", label: "Pena" },
  { id: "book", label: "Livro" },
  { id: "script", label: "Página de roteiro" },
  { id: "drama", label: "Teatro" },
  { id: "idea", label: "Ideia" },
  { id: "sparkles", label: "Inspiração" },
  { id: "car", label: "Automóvel" },
  { id: "building", label: "Institucional" },
  { id: "mountain", label: "Montanhas" },
] as const;
export type ProjectIconId = (typeof projectIcons)[number]["id"];
export const isProjectIconId = (value: unknown): value is ProjectIconId =>
  projectIcons.some((icon) => icon.id === value);
