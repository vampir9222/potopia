-- CreateEnum
CREATE TYPE "core"."Role" AS ENUM ('member', 'admin');

-- CreateTable
CREATE TABLE "core"."users" (
    "id" TEXT NOT NULL,
    "discord_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "core"."Role" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "guild_checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."activity_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_discord_id_key" ON "core"."users"("discord_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "core"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "core"."sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "core"."sessions"("user_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "core"."accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_id_account_id_key" ON "core"."accounts"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "core"."verifications"("identifier");

-- CreateIndex
CREATE INDEX "activity_events_created_at_idx" ON "core"."activity_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "core"."notifications"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "core"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."activity_events" ADD CONSTRAINT "activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
