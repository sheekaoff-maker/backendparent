-- Rollback for 20260720010000_add_device_ipv6. Not run automatically by
-- `prisma migrate deploy`. Apply by hand only if needed:
--   psql "$DATABASE_URL" -f rollback.sql

ALTER TABLE "devices"
  DROP COLUMN IF EXISTS "ipv6_address";
