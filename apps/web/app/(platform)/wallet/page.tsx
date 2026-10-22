import { BRAND } from "@app/config/brand";
import { getBalance, getHistory } from "@app/economy";
import { BalanceCard, TransactionList } from "@app/economy/ui";
import { buttonClasses, Card } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentMember } from "@/lib/session";

export const metadata: Metadata = { title: "Ma monnaie" };

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const user = await getCurrentMember();
  const { cursor } = await searchParams;
  const [balance, history] = await Promise.all([
    getBalance(user.id),
    getHistory(user.id, { limit: 20, cursor: cursor || undefined }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb />
      <BalanceCard balance={balance} />
      <Card title="Historique">
        <p className="text-muted mb-3 text-sm">
          Chaque gain ou dépense de {BRAND.currency.plural}, du plus récent au plus ancien, avec ton
          solde après l&apos;opération.
        </p>
        <TransactionList transactions={history.items} showBalance />
        {(cursor || history.nextCursor) && (
          <div className="mt-3 flex gap-2">
            {cursor && (
              <Link href="/wallet" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                Plus récentes
              </Link>
            )}
            {history.nextCursor && (
              <Link
                href={`/wallet?cursor=${history.nextCursor}`}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Plus anciennes
              </Link>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
