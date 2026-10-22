-- Ordre réel d'application des transactions : une séquence tirée à l'insertion (après le verrou
-- du wallet). created_at vaut le début de la transaction SQL et peut être dans le désordre sous
-- concurrence. Ajouter une colonne ne déclenche pas le trigger d'ajout seul (pas d'UPDATE).
ALTER TABLE "economy"."transactions" ADD COLUMN "seq" BIGSERIAL NOT NULL;
CREATE UNIQUE INDEX "transactions_seq_key" ON "economy"."transactions"("seq");

DROP INDEX "economy"."transactions_user_id_created_at_id_idx";
CREATE INDEX "transactions_user_id_seq_idx" ON "economy"."transactions"("user_id", "seq" DESC);
