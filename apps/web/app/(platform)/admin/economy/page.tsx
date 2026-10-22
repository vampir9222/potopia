import Link from "next/link";
import { BRAND } from "@app/config/brand";
import { getUser, listUsers } from "@app/core";
import { getBalances, getHistory } from "@app/economy";
import { AdminAdjustForm, CurrencyIcon, TransactionList } from "@app/economy/ui";
import { Avatar, buttonClasses, Card, cx } from "@app/ui";
import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/session";
import { adjustBalance } from "./actions";

export const metadata: Metadata = { title: "Monnaie" };

const number = new Intl.NumberFormat(BRAND.locale);

export default async function AdminEconomyPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; cursor?: string }>;
}) {
  await getCurrentAdmin();
  const { user: selectedId, cursor } = await searchParams;
  const members = await listUsers();
  const balances = await getBalances(members.map((m) => m.id));
  const selected = selectedId ? await getUser(selectedId) : null;
  const history = selected ? await getHistory(selected.id, { limit: 20, cursor }) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        <Card title={`Membres (${members.length})`}>
          {members.length === 0 ? (
            <p className="text-muted text-sm">Aucun membre ne s'est encore connecté.</p>
          ) : (
            <ul className="divide-border divide-y">
              {members.map((member) => (
                <li key={member.id}>
                  <Link
                    href={`/admin/economy?user=${member.id}`}
                    className={cx(
                      "hover:bg-surface-hover -mx-2 flex items-center gap-3 rounded-md px-2 py-2",
                      member.id === selected?.id && "bg-surface-hover",
                    )}
                  >
                    <Avatar name={member.name} src={member.image} size={28} />
                    <span className="text-text min-w-0 flex-1 truncate text-sm">{member.name}</span>
                    <span className="text-text text-sm tabular-nums">
                      {number.format(balances.get(member.id) ?? 0)} <CurrencyIcon />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected && history && (
          <Card title={`Historique de ${selected.name}`}>
            <TransactionList transactions={history.items} showBalance />
            {(cursor || history.nextCursor) && (
              <div className="mt-3 flex gap-2">
                {cursor && (
                  <Link
                    href={`/admin/economy?user=${selected.id}`}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    Plus récentes
                  </Link>
                )}
                {history.nextCursor && (
                  <Link
                    href={`/admin/economy?user=${selected.id}&cursor=${history.nextCursor}`}
                    className={buttonClasses({ variant: "secondary", size: "sm" })}
                  >
                    Plus anciennes
                  </Link>
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      <Card title="Créditer ou débiter" className="h-fit">
        <AdminAdjustForm
          members={members.map((m) => ({ id: m.id, name: m.name }))}
          defaultUserId={selected?.id}
          action={adjustBalance}
        />
      </Card>
    </div>
  );
}
