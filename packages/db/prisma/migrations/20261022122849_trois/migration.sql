-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "trois";

-- CreateEnum
CREATE TYPE "trois"."TroisGameStatus" AS ENUM ('PLAYING', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "trois"."games" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "status" "trois"."TroisGameStatus" NOT NULL DEFAULT 'PLAYING',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trois"."guesses" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "word" TEXT NOT NULL,
    "marks" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trois"."daily_words" (
    "date" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "word" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_words_pkey" PRIMARY KEY ("date","slot")
);

-- CreateIndex
CREATE INDEX "games_date_idx" ON "trois"."games"("date");

-- CreateIndex
CREATE UNIQUE INDEX "games_user_id_date_slot_key" ON "trois"."games"("user_id", "date", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "guesses_game_id_attempt_key" ON "trois"."guesses"("game_id", "attempt");

-- CreateIndex
CREATE INDEX "daily_words_word_idx" ON "trois"."daily_words"("word");

-- AddForeignKey
ALTER TABLE "trois"."guesses" ADD CONSTRAINT "guesses_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "trois"."games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
