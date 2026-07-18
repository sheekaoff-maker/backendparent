-- Layer 4: stable device fingerprinting so a device is still recognized after
-- its IP (or MAC, via randomization) changes. All columns are nullable and
-- additive — existing rows are unaffected until the gateway-agent starts
-- reporting fingerprint data or the backfill below runs.

ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "hostname" TEXT;
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "dhcp_client_id" TEXT;
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "vendor_oui" TEXT;
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "os_hint" TEXT;
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "fingerprint_hash" TEXT;
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "fingerprint_updated_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "devices_fingerprint_hash_idx" ON "devices" ("fingerprint_hash");
