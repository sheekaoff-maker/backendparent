# Deploying `20260719000000_add_missing_indexes`

## What this migration does

Adds 7 indexes to existing tables: `rules`, `commands`, `command_acks`,
`gateways`, `router_commands`, `oauth_accounts`, `notification_events`.
No columns, tables, or data change. Every statement is
`CREATE INDEX IF NOT EXISTS`, so re-running it is a safe no-op.

## Pre-deploy checklist

- [ ] Confirm `DATABASE_URL` / `DIRECT_URL` point at the environment you
      intend to migrate (staging first if you have one; this repo's
      `backend/.env` currently points at the live Railway production DB —
      double-check before running anything).
- [ ] Confirm no other pending migrations exist:
      `npx prisma migrate status` should show only this one as pending.
- [ ] Off-peak deploy recommended but not required — these tables are
      small; `CREATE INDEX` (non-concurrent) will hold a brief write lock
      per table, not a long one.

## Apply

```bash
cd backend
npx prisma migrate deploy
```

This is the standard production-safe command: it does not use a shadow
database, does not prompt interactively, does not reset or drop anything —
it applies pending `migration.sql` files in order and records them in
`_prisma_migrations`.

## Verify

```sql
-- Confirm all 7 exist:
SELECT indexname FROM pg_indexes
WHERE indexname IN (
  'rules_child_id_active_idx',
  'commands_device_id_status_idx',
  'command_acks_command_id_idx',
  'gateways_parent_id_idx',
  'router_commands_device_id_idx',
  'oauth_accounts_user_id_idx',
  'notification_events_user_id_createdAt_idx'
);
-- Expect 7 rows.
```

```bash
npx prisma migrate status
# Expect: "Database schema is up to date!"
```

## Rollback

Dropping an index is always safe and instant — it never loses data.

```bash
psql "$DATABASE_URL" -f rollback.sql
```

This does **not** un-record the migration from `_prisma_migrations` — if
you roll back the indexes, also decide whether to leave the migration
"applied" (indexes just don't exist — fine, since every statement here was
`IF NOT EXISTS`/idempotent) or manually delete its row from
`_prisma_migrations` if you want `migrate deploy` to re-attempt it later.

## Expected impact

- `commands_device_id_status_idx` is the highest-value one — every online
  device's poll cycle hits `WHERE deviceId = ? AND status = 'PENDING'` on
  the `commands` table, and it was previously unindexed.
- The other six are lower-traffic today but were flagged because they scale
  with parent/family count, which is exactly the dimension this hardening
  pass targets (1,000 families, 10,000 devices).
- No query behavior changes — only lookup speed. Nothing in application
  code needs to change alongside this migration.
