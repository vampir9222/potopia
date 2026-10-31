import { HiddenEmerald } from "@app/inventory/ui";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentMember } from "@/lib/session";
import { TroisWithMascot } from "./TroisWithMascot";

export const metadata: Metadata = { title: "TROIS" };

export default async function TroisPage() {
  const user = await getCurrentMember();
  return (
    <div className="relative flex flex-col gap-4">
      <Breadcrumb />
      <TroisWithMascot me={{ name: user.name, image: user.image }} />
      <HiddenEmerald color="yellow" className="absolute top-1 left-44" />
    </div>
  );
}
