-- Add indexes to foreign-key/lookup columns that were being scanned without
-- one — flagged in the 2026-07-18 production-hardening audit. All additive,
-- no column/table changes, no data touched. Safe to run against a live
-- database with traffic: CREATE INDEX takes a lock that blocks writes to the
-- table for the duration of the build, but these are small early-stage
-- tables today. If any of these tables have grown large by the time this
-- runs, rebuild the affected CREATE INDEX line(s) as
-- `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` and run them individually
-- with `psql` outside of `prisma migrate deploy` — CONCURRENTLY cannot run
-- inside a transaction block, and Prisma wraps each migration in one.
--
-- Rollback: each statement below has a exact-inverse `DROP INDEX
-- IF EXISTS "<name>";` — see rollback.sql in this same migration folder.
-- Dropping an index is always safe and instant; it cannot lose data.

-- Rule: enforcement.service.ts and rules.service.ts both query
-- `WHERE childId = ? AND active = true` on every rule-sync / session-start.
CREATE INDEX IF NOT EXISTS "rules_child_id_active_idx" ON "rules" ("child_id", "active");

-- Command: child-agent's pending-command poll queries
-- `WHERE deviceId = ? AND status = 'PENDING'` every poll cycle — this is
-- the hottest of the seven, hit by every online device on every poll.
CREATE INDEX IF NOT EXISTS "commands_device_id_status_idx" ON "commands" ("device_id", "status");

-- CommandAck: joined back to its parent Command by commandId.
CREATE INDEX IF NOT EXISTS "command_acks_command_id_idx" ON "command_acks" ("command_id");

-- Gateway: a parent's gateway list is looked up by parentId.
CREATE INDEX IF NOT EXISTS "gateways_parent_id_idx" ON "gateways" ("parent_id");

-- RouterCommand already has an index on (gatewayId, status); device-scoped
-- lookups (executor draining a specific device's queue) had no index.
CREATE INDEX IF NOT EXISTS "router_commands_device_id_idx" ON "router_commands" ("device_id");

-- OAuthAccount: "list this user's linked accounts" has no unique constraint
-- to piggyback on (the existing unique index is on (provider, providerUserId)).
CREATE INDEX IF NOT EXISTS "oauth_accounts_user_id_idx" ON "oauth_accounts" ("user_id");

-- NotificationEvent: the in-app notification feed queries
-- `WHERE userId = ? ORDER BY createdAt DESC LIMIT 50` — compound index
-- covers the filter, and Postgres can scan a plain ascending index backwards
-- just as efficiently for the DESC sort, so no explicit DESC on the index
-- itself — keeping it plain also keeps this migration byte-for-byte
-- consistent with the schema.prisma declaration (`@@index([userId,
-- createdAt])`, no explicit sort direction), so `prisma migrate diff` sees
-- zero drift. Note "createdAt" is NOT snake_cased (this one field has no
-- @map in schema.prisma, unlike its siblings) and must stay quoted exactly
-- as created to match the existing column.
CREATE INDEX IF NOT EXISTS "notification_events_user_id_createdAt_idx" ON "notification_events" ("user_id", "createdAt");
