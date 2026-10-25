import { buttonClasses, EmptyState } from "@app/ui";
import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page introuvable" };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <EmptyState
        icon={<Compass size={32} />}
        title="Page introuvable"
        description="Cette page n'existe pas, ou plus. Vérifie l'adresse ou repars de l'accueil."
        action={
          <Link href="/" className={buttonClasses({ variant: "secondary" })}>
            Retour à l'accueil
          </Link>
        }
      />
    </main>
  );
}
