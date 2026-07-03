import { useEffect, useState } from "react";
import { defaultData, type CitseData } from "./citse-types";

const KEY = "citse-qa-data-v1";

function load(): CitseData {
  if (typeof window === "undefined") return defaultData;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultData;
    return { ...defaultData, ...JSON.parse(raw) };
  } catch {
    return defaultData;
  }
}

let memory: CitseData = defaultData;
const listeners = new Set<() => void>();

export function useCitseData() {
  const [data, setData] = useState<CitseData>(memory);

  useEffect(() => {
    memory = load();
    setData(memory);
    const fn = () => setData({ ...memory });
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const update = (updater: (d: CitseData) => CitseData) => {
    memory = updater(memory);
    try {
      localStorage.setItem(KEY, JSON.stringify(memory));
    } catch {}
    listeners.forEach((l) => l());
  };

  const reset = () => {
    memory = defaultData;
    try {
      localStorage.removeItem(KEY);
    } catch {}
    listeners.forEach((l) => l());
  };

  return { data, update, reset };
}
