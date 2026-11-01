-- CreateTable
CREATE TABLE "goty"."catalog_cache" (
    "key" TEXT NOT NULL,
    "games" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_cache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "goty"."catalog_quotas" (
    "scope" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "catalog_quotas_pkey" PRIMARY KEY ("scope")
);

-- CreateIndex
CREATE INDEX "catalog_cache_expires_at_idx" ON "goty"."catalog_cache"("expires_at");
