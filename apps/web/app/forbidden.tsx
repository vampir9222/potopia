import Link from "next/link";
import { buttonClasses, EmptyState } from "@app/ui";
import { ShieldAlert } from "lucide-react";

export default function Forbidden() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <EmptyState
        icon={<ShieldAlert size={32} />}
        title="Accès refusé"
        description="Cette page est réservée aux admins."
        action={
          <Link href="/" className={buttonClasses({ variant: "secondary" })}>
            Retour à l'accueil
          </Link>
        }
      />
    </main>
  );
}
