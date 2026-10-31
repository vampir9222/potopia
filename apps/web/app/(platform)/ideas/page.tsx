import { IdeaForm } from "@app/ideas/ui";
import { Card } from "@app/ui";
import { HiddenEmerald } from "@app/inventory/ui";
import { EyeOff, Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentMember } from "@/lib/session";
import { sendIdea } from "./actions";

export const metadata: Metadata = { title: "Boîte à idées" };

const FIELDS = [
  ["Titre et description", "l'idée elle-même : ce que la carte représente, l'histoire derrière."],
  ["Personnes concernées", "les membres du serveur à qui elle fait référence."],
  ["Rareté et idée d'effet", "si tu imagines déjà sa puissance ou ce qu'elle ferait en jeu."],
  ["Image", "une capture, un dessin ou un mème pour illustrer."],
] as const;

export default async function IdeasPage() {
  await getCurrentMember();
  return (
    <div className="relative flex flex-col gap-4">
      <Breadcrumb />

      <Card>
        <div className="flex gap-3">
          <Lightbulb size={24} className="text-accent mt-0.5 shrink-0" aria-hidden />
          <div className="flex flex-col gap-3 text-sm">
            <h1 className="text-text flex items-center gap-1 text-base font-semibold">
              C'est quoi, la boîte à idées ? <HiddenEmerald color="purple" />
            </h1>
            <p className="text-muted">
              C'est ici qu'on prépare le futur jeu de cartes du serveur. Un moment culte, une blague
              qui revient tout le temps, un membre qui mériterait sa propre carte… Propose ce qui te
              passe par la tête : les meilleures idées deviendront des cartes.
            </p>
            <ul className="text-muted flex flex-col gap-1">
              {FIELDS.map(([label, description]) => (
                <li key={label}>
                  <span className="text-text font-medium">{label}</span> : {description}
                </li>
              ))}
            </ul>
            <p className="text-muted">Seuls le titre et la description sont obligatoires.</p>
            <div className="border-border flex gap-2 border-t pt-3">
              <EyeOff size={16} className="text-muted mt-0.5 shrink-0" aria-hidden />
              <p className="text-muted">
                <span className="text-text font-medium">C'est confidentiel.</span> Seuls les admins
                lisent les idées. Elles n'apparaissent nulle part sur la plateforme : le fil
                d'activité indique seulement que tu as proposé une idée, sans dire laquelle. Seule
                exception : une idée, choisie par les admins, sert de carte exemple (image comprise)
                sur la page « Vote design des cartes ». Une fois envoyée, tu ne pourras plus la
                relire, alors garde une copie si tu y tiens.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Proposer une idée">
        <IdeaForm action={sendIdea} />
      </Card>
    </div>
  );
}
