import { TroisApp } from "@app/trois/ui";
import { HiddenEmerald } from "@app/inventory/ui";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentMember } from "@/lib/session";

export const metadata: Metadata = { title: "TROIS" };

export default async function TroisPage() {
  const user = await getCurrentMember();
  return (
    <div className="relative flex flex-col gap-4">
      <Breadcrumb />
      <TroisApp me={{ name: user.name, image: user.image }} />
      <HiddenEmerald color="yellow" className="absolute -top-1 right-24" />
    </div>
  );
}
