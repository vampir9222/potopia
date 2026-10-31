import { listCards, listSets } from "@app/tcg";
import { CardEditor } from "@app/tcg/ui";
import { Card } from "@app/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/session";
import { designFonts } from "../../../cartes/fonts";
import { createCardAction } from "../actions";
import { familiesOf } from "../images";

export const metadata: Metadata = { title: "Nouvelle carte" };

export default async function NewCardPage() {
  const admin = await getCurrentAdmin();
  const [sets, cards] = await Promise.all([listSets(admin), listCards(admin)]);
  // Une carte appartient toujours à un set : sans set, on passe par l'import.
  if (sets.length === 0) redirect("/admin/cartes/import");
  const last = sets.at(-1);

  return (
    <Card title="Nouvelle carte">
      <div className={designFonts}>
        <p className="text-muted mb-4 text-sm">
          La carte prend le numéro suivant de son set. L&apos;illustration s&apos;envoie une fois la
          carte créée.
        </p>
        <CardEditor
          card={null}
          sets={sets}
          families={familiesOf(cards)}
          imageUrl={null}
          setSize={cards.filter((c) => c.setId === last?.id).length}
          save={createCardAction}
        />
      </div>
    </Card>
  );
}
