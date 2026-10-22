import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await getCurrentAdmin();
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb />
      {children}
    </div>
  );
}
