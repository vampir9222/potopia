import { listEditions } from "@app/goty";
import { GotyHome } from "@app/goty/ui";
import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Administration GOTY Party" };
export default async function GotyAdminPage() {
  const user = await getCurrentAdmin();
  return (
    <GotyHome editions={await listEditions(user.id)} canCreate year={new Date().getFullYear()} />
  );
}
