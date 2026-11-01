"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Toaster } from "@/components/ui/sonner";
import { store } from "@/lib/store";

const SCALE_KEY = "leaders-hub:scale";

export type FontScale = "md" | "lg" | "xl";

const scaleListeners = new Set<() => void>();
let currentScale: FontScale = "md";

export function applyScale(scale: FontScale) {
  currentScale = scale;
  document.documentElement.dataset.scale = scale;
  try {
    localStorage.setItem(SCALE_KEY, scale);
  } catch {
    /* ignore */
  }
  for (const l of scaleListeners) l();
}

/** 目前字級（伺服器端渲染固定為 md，避免 hydration 不一致）。 */
export function useScale(): FontScale {
  return useSyncExternalStore(
    (l) => {
      scaleListeners.add(l);
      return () => scaleListeners.delete(l);
    },
    () => currentScale,
    () => "md",
  );
}

export function readScale(): FontScale {
  try {
    const v = localStorage.getItem(SCALE_KEY);
    if (v === "lg" || v === "xl") return v;
  } catch {
    /* ignore */
  }
  return "md";
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyScale(readScale());
    store.hydrate();
  }, []);
  return (
    <>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}
