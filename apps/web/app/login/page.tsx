import { BRAND } from "@app/config/brand";
import { getSession } from "@app/core";
import { Button, Card } from "@app/ui";
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
      <Card className="flex w-full max-w-sm flex-col items-center gap-6 py-10 text-center">
        <div>
          <h1 className="text-text text-2xl font-semibold">{BRAND.name}</h1>
          <p className="text-muted mt-1 text-sm">Réservé aux membres du serveur Discord.</p>
        </div>
        <form action={signInWithDiscord} className="w-full">
          <Button type="submit" className="w-full">
            Se connecter avec Discord
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
