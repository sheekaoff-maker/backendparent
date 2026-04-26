-- AlterEnum: NotificationType
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROTECTION_LOW';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REPEATED_BYPASS';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEVICE_DISCONNECTED';

-- AlterTable: Device
ALTER TABLE "devices"
  ADD COLUMN "protection_score"        INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "last_bypass_detected_at" TIMESTAMP(3),
  ADD COLUMN "bypass_attempts"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "typical_active_hours"    JSONB,
  ADD COLUMN "dns_query_pattern_hash"  TEXT,
  ADD COLUMN "daily_limit_minutes"     INTEGER,
  ADD COLUMN "bedtime_start"           TEXT,
  ADD COLUMN "bedtime_end"             TEXT,
  ADD COLUMN "auto_block_enabled"      BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "devices_protection_score_idx" ON "devices"("protection_score");

-- CreateTable: UnknownDomainLog
CREATE TABLE "unknown_domain_logs" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "source_ip" TEXT NOT NULL,
    "device_id" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suggested_category" "BlockCategory",
    "classified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "unknown_domain_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unknown_domain_logs_domain_device_id_key"
  ON "unknown_domain_logs"("domain", "device_id");
CREATE INDEX "unknown_domain_logs_classified_idx" ON "unknown_domain_logs"("classified");
CREATE INDEX "unknown_domain_logs_last_seen_at_idx" ON "unknown_domain_logs"("last_seen_at");
