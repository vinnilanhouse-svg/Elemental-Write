import { useEffect, useRef, useState } from "react";
import type { Manuscript } from "../model";
import { repository } from "./repository";

export const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000;

export function useDocument(
  initial: Manuscript,
  onSaved: (doc: Manuscript) => void,
) {
  const [value, setValue] = useState(initial);
  const latest = useRef(initial);
  const rev = useRef(initial.revision);
  const serial = useRef<Promise<boolean> | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, setStatus] = useState("Salvo neste navegador");
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
          const saved = await repository.saveDocument(snapshot, rev.current);
          rev.current = saved.revision;
          callback.current(saved);
          if (latest.current === snapshot) {
            latest.current = saved;
            setValue(saved);
            dirty.current = false;
            setStatus("Salvo neste navegador");
          } else setStatus("Alterações não salvas");
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
    setValue(latest.current);
    dirty.current = true;
    setStatus("Alterações não salvas");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 650);
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
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
