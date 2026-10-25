"use client";

import { Card } from "@app/ui";
import { ErrorScreen } from "@/components/ErrorScreen";

/** Erreur d'une page de la plateforme : le header et la colonne de gauche restent en place. */
export default function PlatformError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Card>
      <ErrorScreen error={error} retry={retry} />
    </Card>
  );
}
