# PgBouncer

Optional — add once you're running more than 1-2 backend replicas. Not
wired into `docker-compose.yml` by default (kept opt-in so single-replica
deployments aren't forced to run an extra service they don't need).

## Setup

1. Generate `userlist.txt` (never commit real credentials):
   ```
   echo "\"postgres\" \"SCRAM-SHA-256\$...\"" > userlist.txt
   ```
   Or use `pg_dumpall --roles-only` output / your Postgres provider's
   SCRAM hash for the app's DB user.

2. Point `pgbouncer.ini`'s `[databases]` line at your real Postgres host.

3. Run it (Docker):
   ```
   docker run -d --name pgbouncer \
     -v $(pwd)/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini \
     -v $(pwd)/userlist.txt:/etc/pgbouncer/userlist.txt \
     -p 6432:6432 \
     edoburu/pgbouncer
   ```

4. Point the backend's `DATABASE_URL` at PgBouncer's port (6432) with
   `pgbouncer=true`, and keep `DIRECT_URL` pointed straight at Postgres for
   migrations — both documented in `backend/.env.example`.

## Verify it's actually pooling

```sql
-- Connect to the pgbouncer admin console:
psql -h localhost -p 6432 -U postgres pgbouncer
SHOW POOLS;
-- cl_active/cl_waiting show client-side connections; sv_active/sv_idle
-- show real Postgres connections. The whole point is sv_* staying far
-- smaller than cl_* under load.
```
