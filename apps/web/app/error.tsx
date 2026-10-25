"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

/** Erreur hors de la plateforme (layout `(platform)`, /login…) : page entière, sans header. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <ErrorScreen error={error} retry={retry} />
    </main>
  );
}
