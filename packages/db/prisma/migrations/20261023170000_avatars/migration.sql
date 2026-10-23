-- CreateTable
CREATE TABLE "core"."avatars" (
    "user_id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "config_hash" TEXT NOT NULL,
    "sheet_key" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avatars_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "core"."user_avatar_items" (
    "user_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_avatar_items_pkey" PRIMARY KEY ("user_id","item_id")
);

-- AddForeignKey
ALTER TABLE "core"."avatars" ADD CONSTRAINT "avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."user_avatar_items" ADD CONSTRAINT "user_avatar_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
