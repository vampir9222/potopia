import { countUnread, listNotifications } from "@app/core";
import { AccountPanel, Header, NotificationBell } from "@app/core/ui";
import { getBalance } from "@app/economy";
import { BalanceCard } from "@app/economy/ui";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { markAllNotificationsAsRead, markNotificationAsRead } from "@/app/actions/notifications";
import { MobileMenu } from "@/components/MobileMenu";
import { SideNav } from "@/components/SideNav";
import { getCurrentMember } from "@/lib/session";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentMember();
  const [notifications, unreadCount, balance] = await Promise.all([
    listNotifications(user.id, 15),
    countUnread(user.id),
    getBalance(user.id),
  ]);

  // Colonne compte : à gauche sur grand écran, dans le menu latéral sur mobile.
  const accountPanel = (
    <AccountPanel user={user} signOut={signOut}>
      <BalanceCard balance={balance} />
      <SideNav isAdmin={user.role === "admin"} />
    </AccountPanel>
  );

  return (
    <>
      <Header
        user={user}
        menuButton={<MobileMenu>{accountPanel}</MobileMenu>}
        actions={
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            markAsRead={markNotificationAsRead}
            markAllAsRead={markAllNotificationsAsRead}
          />
        }
      />
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="hidden w-72 shrink-0 lg:block">{accountPanel}</aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
