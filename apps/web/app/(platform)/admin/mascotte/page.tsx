import { Button, Card, Textarea } from "@app/ui";
import type { Metadata } from "next";
import { Mascot } from "@/components/Mascot";
import { MASCOT_MAX_BYTES, readMascotPhrases } from "@/lib/mascot";
import { getCurrentAdmin } from "@/lib/session";
import { saveMascotPhrasesAction, uploadMascotAction } from "./actions";

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
  const phrases = await readMascotPhrases();

  return (
    <div className="flex flex-col gap-4">
      <Card title="Mascotte">
        <div className="flex flex-col gap-4 text-sm sm:flex-row sm:items-start">
          <div className="flex flex-col gap-4">
            <p className="text-muted">
              Son visage est celui d&apos;un membre : les images restent dans le stockage privé et
              ne sont montrées qu&apos;aux membres connectés. Le placement des paupières et de la
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
                {ok === "1" && <p className="text-success">Images envoyées.</p>}
                {erreur === "1" && (
                  <p className="text-danger">
                    Fichier refusé : PNG ou WebP uniquement, {Math.floor(MASCOT_MAX_BYTES / 1000)}{" "}
                    Ko au plus.
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
      <Card title="Phrases">
        <form action={saveMascotPhrasesAction} className="flex flex-col gap-3 text-sm">
          <p className="text-muted">
            Une phrase par ligne (80 caractères et 50 phrases au plus). Sur TROIS, la mascotte en
            dit une au hasard dans une bulle, quand un mot est trouvé ou perdu et de temps en temps.
            Comme les images, elles restent dans le stockage privé, jamais dans le repo.
          </p>
          <Textarea name="phrases" rows={8} defaultValue={phrases.join("\n")} />
          <div>
            <Button type="submit">Enregistrer</Button>
          </div>
          <div role="status">
            {ok === "phrases" && <p className="text-success">Phrases enregistrées.</p>}
            {erreur === "phrases" && (
              <p className="text-danger">
                Phrases refusées : 80 caractères par phrase et 50 phrases au plus.
              </p>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
