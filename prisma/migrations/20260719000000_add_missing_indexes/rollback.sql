-- Rollback for 20260719000000_add_missing_indexes.
--
-- Not run automatically by `prisma migrate deploy` — Prisma has no built-in
-- down-migration mechanism. Apply by hand only if one of these indexes
-- turns out to cause an unexpected problem (e.g. write-heavy table where
-- the extra index materially slows inserts):
--
--   psql "$DATABASE_URL" -f rollback.sql
--
-- Dropping an index is always safe and instant — it cannot lose data, only
-- removes the lookup structure the migration added.

DROP INDEX IF EXISTS "rules_child_id_active_idx";
DROP INDEX IF EXISTS "commands_device_id_status_idx";
DROP INDEX IF EXISTS "command_acks_command_id_idx";
DROP INDEX IF EXISTS "gateways_parent_id_idx";
DROP INDEX IF EXISTS "router_commands_device_id_idx";
DROP INDEX IF EXISTS "oauth_accounts_user_id_idx";
DROP INDEX IF EXISTS "notification_events_user_id_createdAt_idx";
