import {
  Clapperboard,
  Film,
  Video,
  Camera,
  MonitorPlay,
  Mic,
  Podcast,
  Headphones,
  Music2,
  Megaphone,
  PenLine,
  Feather,
  BookOpen,
  FileText,
  Drama,
  Lightbulb,
  Sparkles,
  CarFront,
  Building2,
  Mountain,
  type LucideIcon,
} from "lucide-react";
import { type ProjectIconId } from "./icons";

const icons: Record<ProjectIconId, LucideIcon> = {
  clapperboard: Clapperboard,
  film: Film,
  video: Video,
  camera: Camera,
  screen: MonitorPlay,
  mic: Mic,
  podcast: Podcast,
  headphones: Headphones,
  music: Music2,
  megaphone: Megaphone,
  pen: PenLine,
  feather: Feather,
  book: BookOpen,
  script: FileText,
  drama: Drama,
  idea: Lightbulb,
  sparkles: Sparkles,
  car: CarFront,
  building: Building2,
  mountain: Mountain,
};
export function ProjectIcon({
  name = "clapperboard",
  size = 38,
  strokeWidth = 1,
}: {
  name?: ProjectIconId;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = icons[name] || Clapperboard;
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      data-project-icon={name}
    />
  );
}
