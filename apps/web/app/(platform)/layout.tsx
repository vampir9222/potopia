import { countUnread, listNotifications } from "@app/core";
import { AccountPanel, ActivityFeed, Header, NotificationBell } from "@app/core/ui";
import { getBalance } from "@app/economy";
import { BalanceCard } from "@app/economy/ui";
import { hasAllEmeralds, listItems } from "@app/inventory";
import { EmeraldsProvider } from "@app/inventory/ui";
import { Card, resolveTheme, THEME_COOKIE, ThemeSwitcher, VolumeControl } from "@app/ui";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { collectEmerald } from "@/app/actions/inventory";
import { markAllNotificationsAsRead, markNotificationAsRead } from "@/app/actions/notifications";
import { LuffyGatling } from "@/components/LuffyGatling";
import { LuffyRun } from "@/components/LuffyRun";
import { MobileMenu } from "@/components/MobileMenu";
import { SideNav } from "@/components/SideNav";
import { SonicRun } from "@/components/SonicRun";
import { SpinOrb } from "@/components/SpinOrb";
import { getActivityFeed } from "@/lib/activity";
import { getCurrentMember } from "@/lib/session";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentMember();
  // Seuls le nom, l'image et le rôle partent vers les composants (ProfileMenu est un composant
  // client : pas d'email ni d'identifiant Discord dans le HTML ni le bundle).
  const profile = { name: user.name, image: user.image };
  const theme = resolveTheme((await cookies()).get(THEME_COOKIE)?.value);
  const [notifications, unreadCount, balance, feed, items] = await Promise.all([
    listNotifications(user.id, 15),
    countUnread(user.id),
    getBalance(user.id),
    getActivityFeed(),
    listItems(user.id),
  ]);

  // Colonne de gauche (compte puis activité) : fixe sur grand écran, où l'activité prend la hauteur
  // restante de l'écran ; dans le menu latéral sur mobile, où elle garde ses 10 lignes.
  const sidePanels = (fill: boolean) => (
    <div className={fill ? "flex h-full flex-col gap-4" : "flex flex-col gap-4"}>
      <AccountPanel user={{ ...profile, role: user.role }}>
        <BalanceCard balance={balance} />
        <SideNav isAdmin={user.role === "admin"} />
      </AccountPanel>
      <Card
        title="Activité récente"
        className={fill ? "flex min-h-40 flex-1 flex-col overflow-hidden" : undefined}
      >
        <ActivityFeed items={feed} fill={fill} />
      </Card>
    </div>
  );

  // Émeraudes du Chaos déjà trouvées : les pages cachent les autres (`HiddenEmerald`), et les 7
  // transforment Sonic en Super Sonic.
  return (
    <EmeraldsProvider found={items} collect={collectEmerald}>
      <Header
        user={profile}
        signOut={signOut}
        menuButton={<MobileMenu>{sidePanels(false)}</MobileMenu>}
        actions={
          <>
            <SonicRun superSonic={hasAllEmeralds(items)} />
            <LuffyRun />
            <SpinOrb />
            <ThemeSwitcher current={theme} />
            {/* nouvelle notification : Luffy mitraille la cloche, juste à sa droite */}
            <LuffyGatling unreadCount={unreadCount} />
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              markAsRead={markNotificationAsRead}
              markAllAsRead={markAllNotificationsAsRead}
            />
            <VolumeControl />
          </>
        }
      />
      {/* Plein écran : la colonne de gauche reste en place au défilement, le reste pour les apps. */}
      <div className="flex gap-6 px-4 py-6 lg:px-6">
        <aside className="animate-rise sticky top-20 hidden h-[calc(100dvh-6.5rem)] w-80 shrink-0 self-start overflow-y-auto lg:block">
          {sidePanels(true)}
        </aside>
        <main className="page-stagger min-w-0 flex-1">{children}</main>
      </div>
    </EmeraldsProvider>
  );
}
