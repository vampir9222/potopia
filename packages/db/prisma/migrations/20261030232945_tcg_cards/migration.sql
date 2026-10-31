-- CreateEnum
CREATE TYPE "tcg"."TcgRarity" AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary', 'sr', 'ssr');

-- CreateTable
CREATE TABLE "tcg"."sets" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tcg"."cards" (
    "id" TEXT NOT NULL,
    "set_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" "tcg"."TcgRarity" NOT NULL,
    "type" TEXT NOT NULL,
    "family" TEXT,
    "cost" INTEGER NOT NULL,
    "power" INTEGER NOT NULL,
    "effect_key" TEXT,
    "effect_params" JSONB,
    "effect_text" TEXT NOT NULL DEFAULT '',
    "flavor" TEXT,
    "image_key" TEXT,
    "idea_id" TEXT,
    "base_card_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sets_code_key" ON "tcg"."sets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cards_idea_id_key" ON "tcg"."cards"("idea_id");

-- CreateIndex
CREATE UNIQUE INDEX "cards_set_id_number_key" ON "tcg"."cards"("set_id", "number");

-- AddForeignKey
ALTER TABLE "tcg"."cards" ADD CONSTRAINT "cards_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "tcg"."sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tcg"."cards" ADD CONSTRAINT "cards_base_card_id_fkey" FOREIGN KEY ("base_card_id") REFERENCES "tcg"."cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
