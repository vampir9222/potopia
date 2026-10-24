-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "agents";

-- CreateEnum
CREATE TYPE "agents"."AgentsStatus" AS ENUM ('PLAYING', 'WON', 'LOST', 'ABANDONED');

-- CreateEnum
CREATE TYPE "agents"."AgentsPhase" AS ENUM ('CLUE', 'GUESS', 'SUDDEN', 'OVER');

-- CreateEnum
CREATE TYPE "agents"."AgentsResult" AS ENUM ('AGENT', 'BYSTANDER', 'ASSASSIN');

-- CreateTable
CREATE TABLE "agents"."games" (
    "id" TEXT NOT NULL,
    "user_a" TEXT NOT NULL,
    "user_b" TEXT NOT NULL,
    "words" TEXT[],
    "key_a" TEXT NOT NULL,
    "key_b" TEXT NOT NULL,
    "status" "agents"."AgentsStatus" NOT NULL DEFAULT 'PLAYING',
    "phase" "agents"."AgentsPhase" NOT NULL DEFAULT 'CLUE',
    "clue_seat" INTEGER NOT NULL,
    "turns_left" INTEGER NOT NULL DEFAULT 9,
    "turn_guesses" INTEGER NOT NULL DEFAULT 0,
    "mistakes" INTEGER NOT NULL DEFAULT 0,
    "turns_used" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."clues" (
    "game_id" TEXT NOT NULL,
    "turn" INTEGER NOT NULL,
    "seat" INTEGER NOT NULL,
    "word" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clues_pkey" PRIMARY KEY ("game_id","turn")
);

-- CreateTable
CREATE TABLE "agents"."guesses" (
    "game_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "turn" INTEGER NOT NULL,
    "seat" INTEGER NOT NULL,
    "card" INTEGER NOT NULL,
    "result" "agents"."AgentsResult" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guesses_pkey" PRIMARY KEY ("game_id","seq")
);

-- CreateIndex
CREATE INDEX "games_user_a_updated_at_idx" ON "agents"."games"("user_a", "updated_at");

-- CreateIndex
CREATE INDEX "games_user_b_updated_at_idx" ON "agents"."games"("user_b", "updated_at");

-- CreateIndex
CREATE INDEX "games_status_finished_at_idx" ON "agents"."games"("status", "finished_at");

-- AddForeignKey
ALTER TABLE "agents"."clues" ADD CONSTRAINT "clues_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "agents"."games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents"."guesses" ADD CONSTRAINT "guesses_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "agents"."games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
