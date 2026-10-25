import { BRAND } from "@app/config/brand";
import { CurrencyIcon } from "./CurrencyIcon";

export type TransactionItem = {
  id: string;
  amount: number;
  reason: string;
  balanceAfter: number;
  createdAt: Date;
};

type Props = {
  transactions: TransactionItem[];
  /** Affiche le solde après chaque opération (historique admin). */
  showBalance?: boolean;
};

const number = new Intl.NumberFormat(BRAND.locale, { signDisplay: "always" });
const plain = new Intl.NumberFormat(BRAND.locale);
const date = new Intl.DateTimeFormat(BRAND.locale, {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: BRAND.timeZone,
});

export function TransactionList({ transactions, showBalance = false }: Props) {
  if (transactions.length === 0) {
    return <p className="text-muted py-3 text-sm">Aucune transaction.</p>;
  }
  return (
    <ul className="divide-border divide-y">
      {transactions.map((t) => (
        <li key={t.id} className="flex items-center gap-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-text truncate text-sm">{t.reason}</p>
            <p className="text-muted text-xs">{date.format(t.createdAt)}</p>
          </div>
          <div className="text-right">
            <p
              className={`text-sm font-medium tabular-nums ${t.amount > 0 ? "text-accent" : "text-muted"}`}
            >
              {number.format(t.amount)} <CurrencyIcon />
            </p>
            {showBalance && (
              <p className="text-muted text-xs tabular-nums">= {plain.format(t.balanceAfter)}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
