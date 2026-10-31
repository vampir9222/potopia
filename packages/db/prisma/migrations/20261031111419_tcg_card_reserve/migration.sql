-- Modifie l'existant, sans toucher aux données : une carte peut être hors set (réserve, sans
-- numéro) et une idée peut avoir plusieurs cartes (l'index unique sur idea_id devient un index
-- simple).

-- DropForeignKey
ALTER TABLE "tcg"."cards" DROP CONSTRAINT "cards_set_id_fkey";

-- DropIndex
DROP INDEX "tcg"."cards_idea_id_key";

-- AlterTable
ALTER TABLE "tcg"."cards" ALTER COLUMN "set_id" DROP NOT NULL,
ALTER COLUMN "number" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "cards_idea_id_idx" ON "tcg"."cards"("idea_id");

-- AddForeignKey
ALTER TABLE "tcg"."cards" ADD CONSTRAINT "cards_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "tcg"."sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Garde-fou : un numéro si et seulement si la carte est dans un set.
ALTER TABLE "tcg"."cards" ADD CONSTRAINT "cards_set_number_check" CHECK (("set_id" IS NULL) = ("number" IS NULL));
