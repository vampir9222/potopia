-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "goty";

-- CreateEnum
CREATE TYPE "goty"."GotyPhase" AS ENUM ('categories', 'preparation', 'live', 'closed');

-- CreateEnum
CREATE TYPE "goty"."GotyRoundStatus" AS ENUM ('draft', 'announced', 'locked', 'revealing', 'done');

-- CreateTable
CREATE TABLE "goty"."editions" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phase" "goty"."GotyPhase" NOT NULL DEFAULT 'categories',
    "version" INTEGER NOT NULL DEFAULT 1,
    "screen" JSONB NOT NULL DEFAULT '{"mode":"waiting","audio":null}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goty"."members" (
    "edition_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organizer" BOOLEAN NOT NULL DEFAULT false,
    "presenter" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "members_pkey" PRIMARY KEY ("edition_id","user_id")
);

-- CreateTable
CREATE TABLE "goty"."rounds" (
    "id" TEXT NOT NULL,
    "edition_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalized_name" VARCHAR(200) NOT NULL,
    "rank" INTEGER,
    "position" INTEGER NOT NULL,
    "status" "goty"."GotyRoundStatus" NOT NULL DEFAULT 'draft',
    "soundtrack" BOOLEAN NOT NULL DEFAULT false,
    "reveal_order" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "revealed_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goty"."games" (
    "id" TEXT NOT NULL,
    "edition_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "platform" VARCHAR(100) NOT NULL DEFAULT '',
    "period" VARCHAR(100) NOT NULL DEFAULT '',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "platinum" BOOLEAN NOT NULL DEFAULT false,
    "igdb_id" INTEGER,
    "cover" VARCHAR(500),
    "trailer_youtube_id" VARCHAR(11),

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goty"."choices" (
    "round_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "precision" VARCHAR(500) NOT NULL DEFAULT '',
    "youtube" VARCHAR(255),

    CONSTRAINT "choices_pkey" PRIMARY KEY ("round_id","user_id")
);

-- CreateTable
CREATE TABLE "goty"."predictions" (
    "round_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("round_id","user_id","target_id")
);

-- CreateTable
CREATE TABLE "goty"."proposals" (
    "id" TEXT NOT NULL,
    "edition_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalized_name" VARCHAR(200) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goty"."votes" (
    "proposal_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("proposal_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "editions_year_key" ON "goty"."editions"("year");

-- CreateIndex
CREATE INDEX "members_user_id_organizer_idx" ON "goty"."members"("user_id", "organizer");

-- CreateIndex
CREATE INDEX "rounds_edition_id_status_idx" ON "goty"."rounds"("edition_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_edition_id_normalized_name_key" ON "goty"."rounds"("edition_id", "normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_edition_id_position_key" ON "goty"."rounds"("edition_id", "position");

-- CreateIndex
CREATE INDEX "games_edition_id_user_id_idx" ON "goty"."games"("edition_id", "user_id");

-- CreateIndex
CREATE INDEX "choices_game_id_idx" ON "goty"."choices"("game_id");

-- CreateIndex
CREATE INDEX "predictions_game_id_idx" ON "goty"."predictions"("game_id");

-- CreateIndex
CREATE INDEX "proposals_edition_id_user_id_idx" ON "goty"."proposals"("edition_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_edition_id_normalized_name_key" ON "goty"."proposals"("edition_id", "normalized_name");

-- AddForeignKey
ALTER TABLE "goty"."members" ADD CONSTRAINT "members_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "goty"."editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goty"."rounds" ADD CONSTRAINT "rounds_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "goty"."editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goty"."games" ADD CONSTRAINT "games_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "goty"."editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goty"."choices" ADD CONSTRAINT "choices_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "goty"."rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goty"."choices" ADD CONSTRAINT "choices_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "goty"."games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goty"."predictions" ADD CONSTRAINT "predictions_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "goty"."rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goty"."predictions" ADD CONSTRAINT "predictions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "goty"."games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goty"."proposals" ADD CONSTRAINT "proposals_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "goty"."editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goty"."votes" ADD CONSTRAINT "votes_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "goty"."proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
