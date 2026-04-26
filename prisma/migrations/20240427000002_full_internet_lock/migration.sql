-- CreateEnum
CREATE TYPE "BlockingMode" AS ENUM ('GAMING_ONLY', 'FULL_INTERNET_LOCK');

-- AlterTable
ALTER TABLE "devices"
  ADD COLUMN "blocking_mode" "BlockingMode" NOT NULL DEFAULT 'GAMING_ONLY',
  ADD COLUMN "internet_locked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "internet_locked_reason" TEXT,
  ADD COLUMN "internet_locked_at" TIMESTAMP(3);

CREATE INDEX "devices_internet_locked_idx" ON "devices"("internet_locked");
