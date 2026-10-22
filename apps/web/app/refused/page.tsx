import Link from "next/link";
import { buttonClasses, EmptyState } from "@app/ui";
import { UserX } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accès refusé" };

export default function RefusedPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <EmptyState
        icon={<UserX size={32} />}
        title="Accès réservé aux membres du serveur"
        description="Ton compte Discord ne fait pas partie du serveur du groupe. Rejoins-le, puis reconnecte-toi."
        action={
          <Link href="/login" className={buttonClasses({ variant: "secondary" })}>
            Revenir à la connexion
          </Link>
        }
      />
    </main>
  );
}
