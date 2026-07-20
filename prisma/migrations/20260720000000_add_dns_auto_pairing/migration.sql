-- DNS auto-pairing redesign — replaces the manual IP-entry flow (the root
-- cause of devices getting stuck on "DNS not seen yet": dnsSourceIp was
-- never populated by anything). All additive: new enums, new columns with
-- safe defaults, new tables. No existing column is dropped or renamed, so
-- old rows keep working unchanged (paired defaults to false, pair_status
-- defaults to WAITING — an existing device just looks "not yet paired"
-- until it re-pairs once under the new flow).

CREATE TYPE "PairStatus" AS ENUM ('WAITING', 'PAIRED', 'EXPIRED', 'FAILED');
CREATE TYPE "ConnectionEventType" AS ENUM ('PAIRED', 'UNPAIRED', 'IP_CHANGED', 'RECONNECTED', 'CONNECTION_LOST');

ALTER TABLE "devices"
  ADD COLUMN IF NOT EXISTS "paired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "pair_status" "PairStatus" NOT NULL DEFAULT 'WAITING',
  ADD COLUMN IF NOT EXISTS "paired_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolver_region" TEXT,
  ADD COLUMN IF NOT EXISTS "public_ip" TEXT,
  ADD COLUMN IF NOT EXISTS "dns_beacon_token" TEXT;

CREATE INDEX IF NOT EXISTS "devices_pair_status_idx" ON "devices" ("pair_status");
CREATE UNIQUE INDEX IF NOT EXISTS "devices_dns_beacon_token_key" ON "devices" ("dns_beacon_token");

CREATE TABLE IF NOT EXISTS "pairing_sessions" (
  "id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "parent_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "status" "PairStatus" NOT NULL DEFAULT 'WAITING',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pairing_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pairing_sessions_token_key" ON "pairing_sessions" ("token");
CREATE INDEX IF NOT EXISTS "pairing_sessions_device_id_idx" ON "pairing_sessions" ("device_id");
CREATE INDEX IF NOT EXISTS "pairing_sessions_expires_at_idx" ON "pairing_sessions" ("expires_at");

CREATE TABLE IF NOT EXISTS "device_ip_history" (
  "id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "ip_address" TEXT NOT NULL,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_ip_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "device_ip_history_device_id_ip_address_key" ON "device_ip_history" ("device_id", "ip_address");
CREATE INDEX IF NOT EXISTS "device_ip_history_device_id_last_seen_at_idx" ON "device_ip_history" ("device_id", "last_seen_at");

CREATE TABLE IF NOT EXISTS "device_connection_events" (
  "id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "type" "ConnectionEventType" NOT NULL,
  "ip_address" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_connection_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "device_connection_events_device_id_created_at_idx" ON "device_connection_events" ("device_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "pairing_sessions" ADD CONSTRAINT "pairing_sessions_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "device_ip_history" ADD CONSTRAINT "device_ip_history_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "device_connection_events" ADD CONSTRAINT "device_connection_events_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
