import { listItems } from "@app/inventory";
import { InventoryView } from "@app/inventory/ui";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentMember } from "@/lib/session";

export const metadata: Metadata = { title: "Mon inventaire" };

/** Objets trouvés : les Émeraudes du Chaos cachées sur le site, puis les hauts faits à venir. */
export default async function InventoryPage() {
  const user = await getCurrentMember();
  const items = await listItems(user.id);
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb />
      <InventoryView items={items} />
    </div>
  );
}
