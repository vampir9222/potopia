import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SettingsView } from "@/components/SettingsView";
import { getCurrentMember } from "@/lib/session";

export const metadata: Metadata = { title: "Paramètres" };

/** Paramètres du membre (menu de l'avatar du header), gardés sur l'appareil. */
export default async function SettingsPage() {
  await getCurrentMember();
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb />
      <SettingsView />
    </div>
  );
}
