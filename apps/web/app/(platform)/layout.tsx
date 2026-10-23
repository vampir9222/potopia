import { countUnread, listNotifications } from "@app/core";
import { AccountPanel, ActivityFeed, Header, NotificationBell } from "@app/core/ui";
import { getBalance } from "@app/economy";
import { BalanceCard } from "@app/economy/ui";
import { Card, resolveTheme, THEME_COOKIE, ThemeSwitcher, VolumeControl } from "@app/ui";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { markAllNotificationsAsRead, markNotificationAsRead } from "@/app/actions/notifications";
import { AvatarFigure } from "@/components/AvatarFigure";
import { MobileMenu } from "@/components/MobileMenu";
import { SideNav } from "@/components/SideNav";
import { SpinOrb } from "@/components/SpinOrb";
import { getActivityFeed } from "@/lib/activity";
import { getOwnAvatar } from "@/lib/avatar";
import { getCurrentMember } from "@/lib/session";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentMember();
  const theme = resolveTheme((await cookies()).get(THEME_COOKIE)?.value);
  const [notifications, unreadCount, balance, feed, avatar] = await Promise.all([
    listNotifications(user.id, 15),
    countUnread(user.id),
    getBalance(user.id),
    getActivityFeed(),
    getOwnAvatar(user.id),
  ]);

  // Colonne de gauche (compte puis activité) : fixe sur grand écran, où l'activité prend la hauteur
  // restante de l'écran ; dans le menu latéral sur mobile, où elle garde ses 10 lignes.
  const sidePanels = (fill: boolean) => (
    <div className={fill ? "flex h-full flex-col gap-4" : "flex flex-col gap-4"}>
      <AccountPanel
        user={user}
        figure={
          <AvatarFigure userId={user.id} name={user.name} hash={avatar?.configHash ?? null} />
        }
      >
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

  return (
    <>
      <Header
        user={user}
        signOut={signOut}
        menuButton={<MobileMenu>{sidePanels(false)}</MobileMenu>}
        actions={
          <>
            <VolumeControl />
            <SpinOrb />
            <ThemeSwitcher current={theme} />
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              markAsRead={markNotificationAsRead}
              markAllAsRead={markAllNotificationsAsRead}
            />
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
    </>
  );
}
