-- CreateTable
CREATE TABLE "economy"."wallets" (
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "economy"."transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "ref" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "economy"."transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "transactions_user_id_created_at_id_idx" ON "economy"."transactions"("user_id", "created_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "economy"."transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "economy"."wallets"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contraintes métier (non exprimables dans schema.prisma).
ALTER TABLE "economy"."wallets" ADD CONSTRAINT "wallets_balance_non_negative" CHECK ("balance" >= 0);
ALTER TABLE "economy"."transactions" ADD CONSTRAINT "transactions_amount_non_zero" CHECK ("amount" <> 0);

-- Ledger en ajout seul : toute correction passe par une transaction inverse.
CREATE FUNCTION "economy"."forbid_transaction_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'economy.transactions est en ajout seul (% interdit)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "transactions_append_only"
  BEFORE UPDATE OR DELETE ON "economy"."transactions"
  FOR EACH ROW EXECUTE FUNCTION "economy"."forbid_transaction_mutation"();
