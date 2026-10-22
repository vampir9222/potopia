-- CreateEnum
CREATE TYPE "ideas"."Rarity" AS ENUM ('common', 'uncommon', 'rare', 'legendary');

-- CreateTable
CREATE TABLE "ideas"."ideas" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "concerned_people" TEXT,
    "suggested_rarity" "ideas"."Rarity",
    "effect_idea" TEXT,
    "image_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ideas"."idea_uploads" (
    "key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "idea_uploads_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "ideas_image_key_key" ON "ideas"."ideas"("image_key");

-- CreateIndex
CREATE INDEX "ideas_created_at_id_idx" ON "ideas"."ideas"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ideas_author_id_created_at_idx" ON "ideas"."ideas"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "idea_uploads_user_id_created_at_idx" ON "ideas"."idea_uploads"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "ideas"."ideas" ADD CONSTRAINT "ideas_image_key_fkey" FOREIGN KEY ("image_key") REFERENCES "ideas"."idea_uploads"("key") ON DELETE SET NULL ON UPDATE CASCADE;
