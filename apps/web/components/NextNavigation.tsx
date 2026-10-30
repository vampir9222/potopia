"use client";

import { NavigationProvider, type LinkComponent } from "@app/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Donne aux composants des packages (tuiles des apps, logo, notifications, jeux) la navigation de
 * Next : changer de page ne recharge plus le site, le layout et sa musique restent en place.
 */
export function NextNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <NavigationProvider link={Link as LinkComponent} navigate={router.push}>
      {children}
    </NavigationProvider>
  );
}
