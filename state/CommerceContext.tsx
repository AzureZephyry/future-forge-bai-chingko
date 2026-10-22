import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { COMMERCIAL_EVENT, getCommercialSnapshot } from "../lib/documents.ts";
import type { CommercialSnapshot } from "../lib/documents.ts";
import { effectivePlan, FREE_SUBSCRIPTION, nextRefreshAt, remainingUploads } from "../lib/subscription.ts";

function useCommerceState() {
  const [snapshot, setSnapshot] = useState<CommercialSnapshot | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current, time = new Date();
    setNow(time);
    try {
      const next = await getCommercialSnapshot(time);
      if (current === generation.current) { setSnapshot(next); setError(""); }
    } catch { if (current === generation.current) setError("Local document and plan storage is unavailable. No new files can be accepted. Your readiness workspace is still available."); }
  }, []);
  useEffect(() => {
    void refresh();
    const update = () => { void refresh(); };
    const visible = () => { if (document.visibilityState === "visible") update(); };
    const storage = (event: StorageEvent) => { if (event.key === COMMERCIAL_EVENT || event.key === null) update(); };
    let channel: BroadcastChannel | null = null;
    try { channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(COMMERCIAL_EVENT) : null; } catch { /* Focus/storage events still refresh the local state. */ }
    if (channel) channel.onmessage = update;
    window.addEventListener(COMMERCIAL_EVENT, update); window.addEventListener("focus", update);
    window.addEventListener("storage", storage); document.addEventListener("visibilitychange", visible);
    return () => {
      generation.current++; channel?.close(); window.removeEventListener(COMMERCIAL_EVENT, update);
      window.removeEventListener("focus", update); window.removeEventListener("storage", storage); document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  const subscription = snapshot?.subscription ?? FREE_SUBSCRIPTION;
  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, Math.max(1, nextRefreshAt(now, subscription) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [now, subscription, refresh]);
  return { snapshot, subscription, now, error, refresh, plan: effectivePlan(subscription, now),
    remaining: snapshot ? remainingUploads(snapshot.usage, subscription, now) : null };
}
const CommerceContext = createContext<ReturnType<typeof useCommerceState> | null>(null);
export function CommerceProvider({ children }: { children: ReactNode }) {
  const state = useCommerceState();
  return <CommerceContext.Provider value={state}>{children}</CommerceContext.Provider>;
}
export function useCommerce() {
  const state = useContext(CommerceContext);
  if (!state) throw new Error("Commerce provider missing");
  return state;
}
