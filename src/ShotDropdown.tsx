import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { shots, type ShotId } from "./shots";

export function ShotDropdown({
  anchor,
  selected,
  choose,
  close,
}: {
  anchor: HTMLElement | null;
  selected: ShotId | null;
  choose: (id: ShotId) => void;
  close: (restoreEditor: boolean) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(
    Math.max(
      0,
      shots.findIndex((shot) => shot.id === selected),
    ),
  );
  const [position, setPosition] = useState<CSSProperties>({
    visibility: "hidden",
  });
  const callbacks = useRef({ close });
  callbacks.current = { close };
  useLayoutEffect(() => {
    if (!anchor || !panel.current) return;
    const place = () => {
      const el = panel.current;
      if (!el) return;
      const bounds = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const topEdge = (viewport?.offsetTop || 0) + 12;
      const bottomEdge =
        (viewport?.offsetTop || 0) + (viewport?.height || innerHeight) - 12;
      const below = Math.max(0, bottomEdge - bounds.bottom - 8);
      const above = Math.max(0, bounds.top - topEdge - 8);
      const down = below >= 340 || below >= above;
      const maxHeight = Math.max(40, Math.min(340, down ? below : above));
      const width = Math.min(286, innerWidth - 24);
      el.style.width = `${width}px`;
      el.style.maxHeight = `${maxHeight}px`;
      const height = el.getBoundingClientRect().height;
      setPosition({
        width,
        maxHeight,
        visibility: "visible",
        left: Math.max(12, Math.min(bounds.left, innerWidth - width - 12)),
        top: Math.max(
          topEdge,
          down ? bounds.bottom + 8 : bounds.top - height - 8,
        ),
      });
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !anchor.contains(target))
        callbacks.current.close(false);
    };
    place();
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [anchor]);
  useLayoutEffect(() => {
    options.current[active]?.focus({ preventScroll: true });
    options.current[active]?.scrollIntoView({ block: "nearest" });
  }, [active, position.visibility]);
  return createPortal(
    <div
      ref={panel}
      id="shot-options"
      className="shot-dropdown"
      role="listbox"
      aria-label="Planos"
      style={position}
      onKeyDown={(event) => {
        if (["Escape", "Tab"].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        } else if (
          ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
        ) {
          event.preventDefault();
          setActive((index) =>
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? shots.length - 1
                : (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    shots.length) %
                  shots.length,
          );
        } else if (
          event.key.length === 1 &&
          event.key !== " " &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          const next = Array.from(
            { length: shots.length },
            (_, i) => (active + i + 1) % shots.length,
          ).find((index) =>
            shots[index].name
              .toLocaleLowerCase("pt-BR")
              .startsWith(event.key.toLocaleLowerCase("pt-BR")),
          );
          if (next !== undefined) {
            event.preventDefault();
            setActive(next);
          }
        }
      }}
    >
      {shots.map((shot, index) => (
        <button
          key={shot.id}
          ref={(el) => {
            options.current[index] = el;
          }}
          role="option"
          aria-selected={selected === shot.id}
          tabIndex={active === index ? 0 : -1}
          onFocus={() => setActive(index)}
          onClick={() => choose(shot.id)}
        >
          <span className="shot-option-code">{shot.short}</span>
          <span>{shot.name}</span>
          {selected === shot.id && <Check size={13} aria-hidden="true" />}
        </button>
      ))}
    </div>,
    document.body,
  );
}
