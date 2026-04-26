-- CreateEnum
CREATE TYPE "BlockCategory" AS ENUM ('GAMING', 'STREAMING', 'SOCIAL', 'ADULT', 'CUSTOM');

-- AlterTable: BlockedDomain - convert category to enum and add wildcard
ALTER TABLE "blocked_domains" ADD COLUMN "wildcard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "blocked_domains" DROP COLUMN "category";
ALTER TABLE "blocked_domains" ADD COLUMN "category" "BlockCategory";
CREATE INDEX "blocked_domains_category_idx" ON "blocked_domains"("category");

-- CreateTable: CategoryBlock
CREATE TABLE "category_blocks" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "category" "BlockCategory" NOT NULL,
    "reason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "category_blocks_child_id_category_key" ON "category_blocks"("child_id", "category");

ALTER TABLE "category_blocks" ADD CONSTRAINT "category_blocks_child_id_fkey"
  FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: SetupGuide
CREATE TABLE "setup_guides" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "video_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setup_guides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "setup_guides_platform_key" ON "setup_guides"("platform");
