// Réponses JSON des routes /api/trois, typées par l'appelant.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Erreur"), { status: res.status });
  return data as T;
}
