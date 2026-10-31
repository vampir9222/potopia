import { Button, Card } from "@app/ui";
import type { Metadata } from "next";
import { Mascot } from "@/components/Mascot";
import { MASCOT_MAX_BYTES } from "@/lib/mascot";
import { getCurrentAdmin } from "@/lib/session";
import { uploadMascotAction } from "./actions";

export const metadata: Metadata = { title: "Mascotte" };

const FIELDS = [
  ["corps", "Corps", "512 × 673 px, fond transparent, sans la couronne."],
  ["couronne", "Couronne", "102 × 92 px environ, fond transparent."],
] as const;

export default async function MascotPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  await getCurrentAdmin();
  const { ok, erreur } = await searchParams;

  return (
    <Card title="Mascotte">
      <div className="flex flex-col gap-4 text-sm sm:flex-row sm:items-start">
        <div className="flex flex-col gap-4">
          <p className="text-muted">
            Son visage est celui d&apos;un membre : les images restent dans le stockage privé et ne
            sont montrées qu&apos;aux membres connectés. Le placement des paupières et de la
            couronne est réglé pour ces dimensions (voir la doc avant de changer de dessin).
          </p>
          <form action={uploadMascotAction} className="flex flex-col gap-3">
            {FIELDS.map(([name, label, hint]) => (
              <label key={name} className="flex flex-col gap-1">
                <span className="text-text font-medium">{label}</span>
                <span className="text-muted">{hint}</span>
                <input
                  type="file"
                  name={name}
                  accept="image/png,image/webp"
                  className="text-muted"
                />
              </label>
            ))}
            <p className="text-muted">
              PNG ou WebP, {Math.floor(MASCOT_MAX_BYTES / 1000)} Ko au plus. Un champ vide garde
              l&apos;image actuelle ; les membres voient la nouvelle sous 10 minutes.
            </p>
            <div>
              <Button type="submit">Envoyer</Button>
            </div>
            <div role="status">
              {ok && <p className="text-success">Images envoyées.</p>}
              {erreur && (
                <p className="text-danger">
                  Fichier refusé : PNG ou WebP uniquement, {Math.floor(MASCOT_MAX_BYTES / 1000)} Ko
                  au plus.
                </p>
              )}
            </div>
          </form>
        </div>
        <Mascot
          height={220}
          className="self-center"
          fallback={<p className="text-muted">Aucune image pour l&apos;instant.</p>}
        />
      </div>
    </Card>
  );
}
