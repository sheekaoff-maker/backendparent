# Staging environment

## Status

**Config prepared and validated. Not deployed** — no Docker daemon was
available in the sandbox this was authored in (`docker compose config`
works without the daemon; actually starting containers needs it running).
Everything below is real, checked config — not a claim that it's running
anywhere right now.

What was actually verified, offline, without a daemon:
- `docker compose -f docker-compose.yml -f docker-compose.staging.yml config --quiet` — merges and validates cleanly.
- The required-secret guards (`${STAGING_JWT_SECRET:?...}` etc.) genuinely fail closed: running without them errors out with a clear message instead of silently deploying blank secrets — confirmed by removing them and watching it fail.
- The base `docker-compose.yml` still validates standalone (no regression for local dev).

## What's included

Postgres, Redis, backend, dns-service, web-client, and gateway-agent
(dry-run — see `gateway-agent/Dockerfile.staging` for exactly why
production itself stays bare-metal). `isp-adapter` is deliberately excluded
— it's a standalone prototype, not part of the live product (see
`k8s/README.md` for the same note in the Kubernetes context).

## Bring it up

```bash
cd backend
export STAGING_JWT_SECRET=$(openssl rand -base64 48)
export STAGING_JWT_REFRESH_SECRET=$(openssl rand -base64 48)
export STAGING_ENCRYPTION_KEY=$(openssl rand -base64 24 | cut -c1-32)
# GATEWAY_TOKEN needs a real paired gateway row — seed one first (see
# simulation/scenario-runner), then:
export STAGING_GATEWAY_TOKEN=<the seeded token>

docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build
```

## Verification checklist

Run these after `up -d` — none of them were run against a live staging
stack in this pass (no daemon available), but they're the exact commands
to run once one exists:

- [ ] **Health / liveness / readiness**
  ```bash
  curl -f http://localhost:3000/health         # backend liveness
  curl -f http://localhost:3000/health/ready    # backend readiness (DB+Redis+Firebase)
  curl -f http://localhost:8080/health          # dns-service liveness
  curl -f http://localhost:8080/health/ready    # dns-service readiness (backend reachable)
  curl -f http://localhost:3001/                # web client responds
  docker compose ps                              # every service shows "healthy"
  ```
- [ ] **Database migrations applied**
  ```bash
  docker compose exec backend npx prisma migrate status
  # Expect: "Database schema is up to date!" — this also proves the new
  # 20260719000000_add_missing_indexes migration applies cleanly, since
  # `migrate deploy` runs it automatically on container start.
  ```
- [ ] **DNS resolution**
  ```bash
  dig @127.0.0.1 -p 53 youtube.com          # expect a real A record (ALLOW path, upstream forward)
  dig @127.0.0.1 -p 53 roblox.com           # expect 0.0.0.0 if roblox.com is seeded as blocked
  ```
- [ ] **Gateway communication** — after seeding a device/gateway pair:
  ```bash
  docker compose logs gateway-agent --tail=50
  # Expect: "gateway policy sync complete" lines every ~3s (POLL_INTERVAL_MS),
  # no repeated auth errors.
  ```
- [ ] **Router integration** — gateway-agent's read-only detection runs
      automatically (`ENABLE_ROUTER_DETECTION=true`); in a Docker bridge
      network there's no real router to find, so expect
      `integration_status: UNDETECTED` rather than an error. A false
      "router found" would be the bug to watch for; finding nothing is
      correct here.
- [ ] **Prometheus metrics reachable internally**
  ```bash
  curl -f http://localhost:3000/metrics | head -20
  ```

## Tear down

```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml down -v
```
`-v` also drops the Postgres/Redis volumes — this is staging, not
production; there's nothing there worth keeping between runs.
