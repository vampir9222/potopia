"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MemberSnapshot, PresentationSnapshot } from "../src/snapshot";
import { api, GotyRequestError, RequestEpoch } from "./api";

type Snapshot = MemberSnapshot | PresentationSnapshot;
export function useSnapshot<T extends Snapshot>(
  initial: T,
  viewerId: string,
  tv = false,
  initialAdmin = false,
) {
  const [snapshot, setSnapshot] = useState<T | null>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isAdmin, setAdmin] = useState(initialAdmin);
  const invalidViewer = useRef(false);
  const ref = useRef(initial);
  const etag = useRef("");
  const epoch = useRef(new RequestEpoch());
  const inFlight = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const active = useRef(true);
  const endpoint = `editions/${initial.edition.id}${tv ? "/presentation" : ""}`;
  const refresh = useCallback(async () => {
    if (!active.current || inFlight.current || invalidViewer.current) return;
    const ticket = epoch.current.next();
    const controller = new AbortController();
    inFlight.current = controller;
    try {
      const response = await fetch(`/api/goty/${endpoint}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
        headers: etag.current ? { "if-none-match": etag.current } : undefined,
      });
      if (!epoch.current.current(ticket) || !active.current) return;
      const viewer = response.headers.get("x-goty-viewer");
      if (viewer && viewer !== viewerId) {
        invalidViewer.current = true;
        setSnapshot(null);
        setError("Le compte connecté a changé. Reviens aux éditions pour continuer.");
        return;
      }
      const admin = response.headers.get("x-goty-admin");
      if (admin !== null) setAdmin(admin === "true");
      if (response.status === 304) {
        setError("");
        return;
      }
      const data = await response.json();
      if (!epoch.current.current(ticket) || !active.current) return;
      if (!response.ok)
        throw new GotyRequestError(
          data.error?.message ?? "Actualisation indisponible.",
          response.status,
        );
      ref.current = data as T;
      etag.current = response.headers.get("etag") ?? "";
      setSnapshot(data as T);
      setError("");
    } catch (caught) {
      if (controller.signal.aborted || !active.current || !epoch.current.current(ticket)) return;
      if (caught instanceof GotyRequestError && [401, 403, 404].includes(caught.status))
        setSnapshot(null);
      setError(caught instanceof Error ? caught.message : "Connexion interrompue.");
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, [endpoint, viewerId]);

  useEffect(() => {
    active.current = true;
    const update = () => {
      if (!document.hidden && !writing.current) void refresh();
    };
    const visibility = () => {
      if (document.hidden) {
        epoch.current.next();
        inFlight.current?.abort();
        inFlight.current = null;
      } else update();
    };
    const timer = window.setInterval(update, 3000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", update);
    update();
    return () => {
      active.current = false;
      epoch.current.next();
      inFlight.current?.abort();
      inFlight.current = null;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", update);
    };
  }, [refresh]);

  const mutate = useCallback(
    async (suffix: string, method: string, body?: unknown) => {
      if (writing.current || invalidViewer.current) return false;
      writing.current = true;
      setBusy(true);
      setError("");
      epoch.current.next();
      inFlight.current?.abort();
      inFlight.current = null;
      let success = false;
      let mutationError = "";
      try {
        await api(`editions/${ref.current.edition.id}/${suffix}`, method, body);
        success = true;
      } catch (caught) {
        if (!active.current) return false;
        if (caught instanceof GotyRequestError && [401, 403, 404].includes(caught.status))
          setSnapshot(null);
        mutationError = caught instanceof Error ? caught.message : "Enregistrement impossible.";
        setError(mutationError);
      } finally {
        if (active.current) {
          const previousError = success
            ? ""
            : "Les données ont pu changer. Vérifie l’état actualisé avant de réessayer.";
          etag.current = "";
          await refresh();
          if (!success) setError((message) => mutationError || message || previousError);
          setBusy(false);
        }
        writing.current = false;
      }
      return success;
    },
    [refresh],
  );
  return { snapshot, error, busy, mutate, refresh, current: ref, isAdmin };
}
export type Mutation = ReturnType<typeof useSnapshot>["mutate"];
