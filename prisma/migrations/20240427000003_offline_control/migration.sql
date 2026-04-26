-- CreateEnum
CREATE TYPE "ProtectionStatus" AS ENUM ('NORMAL', 'POSSIBLE_DNS_BYPASS', 'COMPROMISED');

-- AlterEnum: NotificationType
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'POSSIBLE_DNS_BYPASS';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OFFLINE_SETUP_INCOMPLETE';

-- AlterTable: Device
ALTER TABLE "devices"
  ADD COLUMN "protection_status"        "ProtectionStatus" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "offline_control_enabled"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "offline_control_method"   TEXT,
  ADD COLUMN "offline_setup_completed_at" TIMESTAMP(3),
  ADD COLUMN "offline_setup_verified"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "offline_control_notes"    TEXT;

CREATE INDEX "devices_protection_status_idx" ON "devices"("protection_status");

-- CreateTable
CREATE TABLE "offline_control_checklists" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "pin_enabled" BOOLEAN NOT NULL DEFAULT false,
    "child_account_linked" BOOLEAN NOT NULL DEFAULT false,
    "play_time_limit_enabled" BOOLEAN NOT NULL DEFAULT false,
    "age_rating_enabled" BOOLEAN NOT NULL DEFAULT false,
    "purchases_blocked" BOOLEAN NOT NULL DEFAULT false,
    "network_settings_locked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_control_checklists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "offline_control_checklists_device_id_key" ON "offline_control_checklists"("device_id");

ALTER TABLE "offline_control_checklists"
  ADD CONSTRAINT "offline_control_checklists_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
