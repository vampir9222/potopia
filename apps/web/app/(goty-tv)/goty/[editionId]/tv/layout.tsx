import type { ReactNode } from "react";
import { getCurrentMember } from "@/lib/session";

export default async function GotyTVLayout({ children }: { children: ReactNode }) {
  await getCurrentMember();
  return children;
}
