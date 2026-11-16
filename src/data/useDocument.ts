import { useEffect, useRef, useState } from "react";
import type { Manuscript } from "../model";
import { repository, cloudMode, cloudOwnerId } from "./repository";

export const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000;

export function useDocument(
  initial: Manuscript,
  onSaved: (doc: Manuscript) => void,
) {
  const storage = useRef(repository).current;
  const remote = useRef(cloudMode).current;
  const ownerId = useRef(cloudOwnerId).current;
  const draftKey = remote
    ? `ew.cloud.draft.${ownerId}.${initial.projectId}.${initial.id}`
    : "";
  const [recovered] = useState(() => {
    if (!draftKey) return initial;
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) || "null");
      return d?.id === initial.id ? (d as Manuscript) : initial;
    } catch {
      return initial;
    }
  });
  const [value, setValue] = useState(recovered);
  const latest = useRef(recovered);
  const rev = useRef(recovered.revision);
  const serial = useRef<Promise<boolean> | null>(null);
  const dirty = useRef(recovered !== initial);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, setStatus] = useState(
    recovered !== initial
      ? "Rascunho recuperado — aguardando salvamento"
      : remote
        ? "Salvo na nuvem"
        : "Salvo neste navegador",
  );
  const [error, setError] = useState("");
  const callback = useRef(onSaved);
  callback.current = onSaved;
  const flush = async (): Promise<boolean> => {
    clearTimeout(timer.current);
    if (serial.current) {
      const ok = await serial.current;
      if (!ok) return false;
      return dirty.current ? flush() : true;
    }
    if (!dirty.current) return true;
    const work = async () => {
      while (dirty.current) {
        const snapshot = latest.current;
        setStatus("Salvando…");
        try {
          const saved = await storage.saveDocument(snapshot, rev.current);
          rev.current = saved.revision;
          callback.current(saved);
          if (latest.current === snapshot) {
            latest.current = saved;
            setValue(saved);
            dirty.current = false;
            setStatus(remote ? "Salvo na nuvem" : "Salvo neste navegador");
            if (draftKey) {
              try {
                localStorage.removeItem(draftKey);
              } catch {
                /* Remote save succeeded. */
              }
            }
          } else {
            latest.current = { ...latest.current, revision: saved.revision };
            if (draftKey) {
              try {
                localStorage.setItem(draftKey, JSON.stringify(latest.current));
              } catch {
                /* Text remains in memory. */
              }
            }
            setStatus("Alterações não salvas");
          }
          setError("");
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível salvar. Verifique o espaço disponível.",
          );
          setStatus("Erro ao salvar");
          return false;
        }
      }
      return true;
    };
    serial.current = work();
    try {
      return await serial.current;
    } finally {
      serial.current = null;
    }
  };
  const change = (patch: Partial<Manuscript>) => {
    latest.current = { ...latest.current, ...patch };
    if (draftKey) {
      try {
        localStorage.setItem(draftKey, JSON.stringify(latest.current));
      } catch {
        setError(
          "Não foi possível guardar o rascunho neste dispositivo. Mantenha esta aba aberta e exporte seu texto.",
        );
      }
    }
    setValue(latest.current);
    dirty.current = true;
    setStatus("Alterações não salvas");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 650);
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    if (dirty.current)
      timer.current = setTimeout(() => void flushRef.current(), 650);
    // This interval is independent of typing, which keeps resetting the debounce.
    const periodicSave = setInterval(() => {
      void flushRef.current();
    }, AUTOSAVE_INTERVAL_MS);
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        void flushRef.current();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const hide = () => {
      if (document.visibilityState === "hidden") void flushRef.current();
    };
    window.addEventListener("beforeunload", leave);
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearInterval(periodicSave);
      clearTimeout(timer.current);
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  return { value, change, flush, status, error, latest };
}
