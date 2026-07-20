-- Rollback for 20260720000000_add_dns_auto_pairing. Not run automatically
-- by `prisma migrate deploy` (Prisma has no down-migration mechanism).
-- Apply by hand only if the pairing feature needs to be pulled:
--   psql "$DATABASE_URL" -f rollback.sql
--
-- Drops new tables/columns only — never touches ipAddress/dnsSourceIp/
-- lastDnsSeenAt or any other pre-existing device data.

DROP TABLE IF EXISTS "device_connection_events";
DROP TABLE IF EXISTS "device_ip_history";
DROP TABLE IF EXISTS "pairing_sessions";

ALTER TABLE "devices"
  DROP COLUMN IF EXISTS "paired",
  DROP COLUMN IF EXISTS "pair_status",
  DROP COLUMN IF EXISTS "paired_at",
  DROP COLUMN IF EXISTS "resolver_region",
  DROP COLUMN IF EXISTS "public_ip",
  DROP COLUMN IF EXISTS "dns_beacon_token";

DROP TYPE IF EXISTS "ConnectionEventType";
DROP TYPE IF EXISTS "PairStatus";
