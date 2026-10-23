-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tcg";

-- CreateTable
CREATE TABLE "tcg"."design_votes" (
    "id" TEXT NOT NULL,
    "design_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "design_votes_design_id_user_id_key" ON "tcg"."design_votes"("design_id", "user_id");
