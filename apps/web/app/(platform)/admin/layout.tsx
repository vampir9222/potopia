import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await getCurrentAdmin();
  return (
    <div className="flex flex-col gap-4">
      <nav className="text-muted flex gap-4 text-sm">
        <Link href="/admin" className="hover:text-text">
          Administration
        </Link>
        <Link href="/admin/economy" className="hover:text-text">
          Monnaie
        </Link>
      </nav>
      {children}
    </div>
  );
}
