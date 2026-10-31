"use client";

import { Button, buttonClasses, EmptyState } from "@app/ui";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Mascot } from "./Mascot";

type Props = {
  /** Valeur levée (une `Error` depuis le serveur, n'importe quoi depuis un composant client). */
  error: unknown;
  /** Rejoue le rendu du segment en erreur (fourni par Next aux fichiers `error.tsx`). */
  retry: () => void;
};

/**
 * Contenu commun des pages d'erreur (`error.tsx`) : aucun détail technique affiché, l'erreur part
 * dans la console pour le diagnostic ; l'utilisateur peut réessayer ou revenir à l'accueil.
 */
export function ErrorScreen({ error, retry }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={<Mascot mood="erreur" height={140} fallback={<TriangleAlert size={32} />} />}
      title="Quelque chose s'est mal passé"
      description="Une erreur est survenue de notre côté. Réessaie dans un instant ; si ça continue, préviens un admin."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => retry()}>Réessayer</Button>
          <Link href="/" className={buttonClasses({ variant: "secondary" })}>
            Accueil
          </Link>
        </div>
      }
    />
  );
}
