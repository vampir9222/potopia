import { BRAND } from "@app/config/brand";
import { getSession } from "@app/core";
import { Button, Card } from "@app/ui";
import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signInWithDiscord } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  access_denied: "Connexion annulée côté Discord.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession(await headers())) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="animate-rise flex w-full max-w-sm flex-col items-center gap-6 px-6 py-10 text-center">
        {/* emblème qui flotte, entouré d'un halo */}
        <div className="animate-float relative grid size-20 place-items-center">
          <span className="bg-arcane/30 absolute inset-0 rounded-full blur-xl" aria-hidden />
          <span className="border-accent/60 bg-surface relative grid size-16 place-items-center rounded-full border shadow-[0_0_24px_-4px_var(--accent)]">
            <Sparkles size={28} className="text-accent" aria-hidden />
          </span>
        </div>
        <div>
          <h1 className="font-display text-gradient text-4xl font-bold tracking-[0.12em]">
            {BRAND.name}
          </h1>
          <p className="text-muted mt-2 text-sm">
            Les jeux du serveur, entre membres.
            <br />
            Connecte-toi avec ton compte Discord pour entrer.
          </p>
        </div>
        <form action={signInWithDiscord} className="w-full">
          <Button type="submit" className="h-11 w-full text-base">
            Entrer avec Discord
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-danger text-sm">
            {ERRORS[error] ?? "La connexion a échoué. Réessaie dans un instant."}
          </p>
        )}
      </Card>
    </main>
  );
}
