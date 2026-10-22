import { BRAND, formatCurrency } from "@app/config/brand";

type Props = {
  balance: number;
};

export function BalanceCard({ balance }: Props) {
  return (
    <div className="border-border bg-bg rounded-lg border p-3">
      <p className="text-muted text-xs">Solde</p>
      <p className="text-text text-2xl font-semibold" title={formatCurrency(balance)}>
        {new Intl.NumberFormat(BRAND.locale).format(balance)}{" "}
        <span className="text-accent text-base">{BRAND.currency.symbol}</span>
      </p>
    </div>
  );
}
