# Smart Parental Control Backend

A production-ready backend for a smart parental control system built with **NestJS**, **PostgreSQL**, **Prisma**, **Redis**, **JWT**, and **Swagger**.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Parent     │────▶│   Backend   │────▶│  PostgreSQL   │
│   App/API    │     │   (NestJS)  │     │  (Prisma ORM) │
└─────────────┘     └──────┬──────┘     └──────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
              ┌─────▼─────┐ ┌────▼─────┐
              │   Redis   │ │ Gateway  │
              │  (Cache)  │ │  (Pi/    │
              └───────────┘ │  Router) │
                            └──────────┘
```

## Modules

| Module | Description |
|--------|-------------|
| **Auth** | Parent register/login, JWT access+refresh tokens, bcrypt hashing, role-based auth (PARENT, CHILD_DEVICE, GATEWAY) |
| **Parents** | Profile CRUD, subscription placeholder |
| **Children** | Child profile CRUD with avatar, age, default limits |
| **Devices** | Device CRUD with type/control method enums, status tracking |
| **Rules** | Daily limit, bedtime, school time, weekend mode, reward extra time, blocked apps/categories |
| **Sessions** | Start/pause/resume/extend/stop/expire sessions, remaining time calculation, daily limit enforcement |
| **UsageLogs** | Receive usage logs, aggregate daily/weekly reports, detect active app |
| **Enforcement** | Adapter pattern with 5 adapters: AndroidAgent, IosScreenTime, Xbox, NetworkGateway, Mock |
| **ChildAgent** | Endpoints for child agent polling, command ack, usage logs, status, time requests |
| **Gateway** | Register/pair gateway, list devices, block/unblock via gateway token auth |
| **OAuth** | Microsoft OAuth flow skeleton with encrypted token storage |
| **Notifications** | Notification events with FCM placeholder |
| **Scheduler** | Every-minute cron: check active sessions, enforce bedtime rules, send notifications, audit logs |
| **Audit** | Audit log for all enforcement and administrative actions |
| **Queue** | BullMQ command delivery queue with Redis, retry logic, and status tracking |
| **DnsPolicy** | DNS filtering: real-time ALLOW/BLOCK decisions for domain queries, Redis-cached (30s), logs all queries |
| **Categories** | Block-by-category engine (GAMING / STREAMING / SOCIAL / ADULT / CUSTOM) with wildcard domains + per-child category blocks |
| **PlatformSupport** | Honest device-support matrix + step-by-step setup guides for PlayStation / Nintendo / Xbox / Smart TV / Router |

## What This Backend Can And CANNOT Do (Reality Check)

This backend is **honest** about platform limits. The frontend should display these to parents.

### ✅ What we CAN do globally (via DNS filtering):
- Block ALL online gaming traffic on **any** device on the home network: PSN, Xbox Live, Nintendo eShop, Steam, Epic, Battle.net, Riot, Discord, Twitch, Roblox, Fortnite, etc.
- Block streaming (YouTube, Netflix, TikTok, etc.) and social (Instagram, Snapchat, etc.) the same way.
- Per-child category blocks (GAMING / STREAMING / SOCIAL / ADULT / CUSTOM) — see `/admin/blocklists/children/:childId/categories`.

### ✅ What we CAN do per device:
| Platform | Online block | Offline block | How |
|----------|:-:|:-:|---|
| Android | ✅ | ✅ | Child agent app (Device Admin) |
| iOS / iPad | ✅ | ✅ | Apple Family Controls entitlement |
| Xbox | ✅ | ✅ | Microsoft Family OAuth |

### ❌ What we CANNOT do (no agent / no API):
| Platform | Online block | Offline block | What parents must do |
|----------|:-:|:-:|---|
| PlayStation | ✅ via DNS | ❌ | Use Sony **PSN Family** parental controls (we provide a step-by-step guide via `/platform-support/guides/PLAYSTATION`) |
| Nintendo Switch | ✅ via DNS | ❌ | Use the **Nintendo Switch Parental Controls** mobile app (guide at `/platform-support/guides/NINTENDO`) |
| Smart TV | ✅ via DNS | ❌ | Set DNS at the router so the TV is forced through our filter |
| Steam Deck / PC | ✅ via DNS | ❌ | Use **Steam Family View** + Windows/macOS parental controls |

We will **never claim** to stop a child playing an offline single-player game on a console where the platform vendor does not give us an API. The honest path is DNS-block-online + redirect-the-parent-to-the-vendor-tools.



### Android (Agent App)
- **Method**: Child-side agent app with Device Admin privileges
- **Capabilities**: Full control — block apps, lock device, sync rules, enforce bedtime
- **Status**: ✅ Fully supported via command queue

### iOS (Screen Time API)
- **Method**: Apple Family Controls + ManagedSettings + DeviceActivity frameworks
- **Capabilities**: Screen Time restrictions, app limits, communication limits
- **Limitations**: **Requires Apple Family Controls entitlement** (must be requested from Apple). Without it, the iOS adapter stores rules but cannot enforce them natively.
- **Status**: ⚠️ Skeleton implemented — requires native Swift implementation + Apple entitlement

### Xbox
- **Method**: Microsoft Family Safety API + network gateway fallback
- **Capabilities**: Time limits, content restrictions (if Microsoft API available)
- **Limitations**: Direct family control APIs for Xbox are not publicly available. Falls back to network gateway if no Microsoft OAuth linked.
- **Status**: ⚠️ Skeleton + gateway fallback

### PlayStation / Smart TV / Streaming Boxes
- **Method**: Network gateway only (router/Raspberry Pi)
- **Capabilities**: Block/unblock internet access
- **Limitations**: **Cannot kill offline games directly**. Only online access can be controlled. For offline violations, the system:
  1. Expires the session
  2. Blocks internet via gateway
  3. Prevents future online access
  4. Applies cooldown
  5. Notifies parent
  6. Marks session as violated
- **Status**: ⚠️ Network-level only

## Mock Mode

All adapters have a **MockAdapter** fallback. Set a device's `controlMethod` to `MOCK` for development/testing. The mock adapter returns success for all operations without performing real enforcement.

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- (Optional) Docker & Docker Compose

### Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development server
npm run start:dev
```

### Docker Compose

```bash
# Start all services (postgres, redis, backend, mock-gateway)
docker-compose up -d

# Run migrations inside container
docker-compose exec backend npx prisma migrate deploy

# View logs
docker-compose logs -f backend
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/parental_control` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | Access token secret | — |
| `JWT_REFRESH_SECRET` | Refresh token secret | — |
| `JWT_EXPIRATION` | Access token expiry | `15m` |
| `JWT_REFRESH_EXPIRATION` | Refresh token expiry | `7d` |
| `ENCRYPTION_KEY` | AES-256-CBC key (32 chars) | — |
| `MICROSOFT_OAUTH_CLIENT_ID` | Microsoft OAuth client ID | — |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | Microsoft OAuth client secret | — |
| `MICROSOFT_OAUTH_REDIRECT_URI` | Microsoft OAuth redirect URI | — |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging key | — |
| `PORT` | Server port | `3000` |

### API Documentation

After starting the server, visit:
```
http://localhost:3000/api/docs
```

## API Endpoints Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register` | POST | Register parent |
| `/auth/login` | POST | Login |
| `/auth/refresh` | POST | Refresh tokens |
| `/auth/logout` | POST | Logout |
| `/parents/profile` | GET/PATCH | Parent profile |
| `/parents/subscription` | GET | Subscription info |
| `/children` | POST/GET | Create/list children |
| `/children/:id` | GET/PATCH/DELETE | Child CRUD |
| `/devices` | POST/GET | Create/list devices |
| `/devices/:id` | GET/PATCH/DELETE | Device CRUD |
| `/rules` | POST/GET | Create/list rules |
| `/rules/:id` | PATCH/DELETE | Update/delete rule |
| `/sessions/start` | POST | Start session |
| `/sessions/:id/pause` | POST | Pause session |
| `/sessions/:id/resume` | POST | Resume session |
| `/sessions/:id/extend` | POST | Extend session |
| `/sessions/:id/stop` | POST | Stop session |
| `/sessions/active` | GET | Active sessions |
| `/sessions/history` | GET | Session history |
| `/usage/daily` | GET | Daily usage report |
| `/usage/weekly` | GET | Weekly usage report |
| `/usage/device/:id` | GET | Device usage |
| `/enforcement/block` | POST | Block device |
| `/enforcement/unblock` | POST | Unblock device |
| `/enforcement/sync` | POST | Sync rules to device |
| `/child/register-device` | POST | Register device from agent |
| `/child/rules` | GET | Get rules (agent poll) |
| `/child/commands` | GET | Get commands (agent poll) |
| `/child/command-ack` | POST | Acknowledge command |
| `/child/usage-log` | POST | Report usage |
| `/child/request-more-time` | POST | Child time request |
| `/child/status` | POST | Report device status |
| `/gateway/register` | POST | Register gateway |
| `/gateway/pair` | POST | Pair gateway |
| `/gateway/devices` | GET | List gateway devices |
| `/gateway/block` | POST | Block via gateway |
| `/gateway/unblock` | POST | Unblock via gateway |
| `/oauth/microsoft/url` | GET | Get OAuth URL |
| `/oauth/microsoft/callback` | GET | OAuth callback |
| `/oauth/microsoft/refresh` | POST | Refresh OAuth token |
| `/dns/policy/check` | GET | Check DNS policy (sourceIp + domain) → ALLOW/BLOCK |
| `/devices/:id/internet-lock` | POST | **FULL INTERNET LOCK** for a device — blocks ALL online traffic |
| `/devices/:id/internet-unlock` | POST | Restore normal policy (GAMING_ONLY) |
| `/devices/:id/network-status` | GET | Current blockingMode + last DNS-seen + offline-control note |
| `/admin/blocklists/domains` | GET / POST | List or add blocked domains (filter by `?category=GAMING`) |
| `/admin/blocklists/domains/bulk` | POST | Bulk-import blocked domains |
| `/admin/blocklists/domains/:id` | DELETE | Remove a blocked domain |
| `/admin/blocklists/children/:childId/categories` | GET / POST | List or set category blocks for a child |
| `/platform-support/matrix` | GET | Full device-type support matrix (online/offline) |
| `/platform-support/matrix/:deviceType` | GET | Support info for one device type |
| `/platform-support/guides` | GET | All parental-control setup guides |
| `/platform-support/guides/:platform` | GET | Setup guide for PLAYSTATION / NINTENDO / XBOX / SMART_TV / ROUTER |

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run specific test file
npx jest test/sessions.spec.ts
npx jest test/enforcement.spec.ts
```

### Test Coverage

Tests cover:
- Session remaining time calculation
- Daily limit exceeded prevention
- Adapter selection by device type
- Android command creation
- iOS rule sync
- Gateway block fallback (no gateway assigned)
- Offline unsupported console behavior (PlayStation, Smart TV)
- Scheduler session expiration detection

## Security

- **JWT** access + refresh tokens with bcrypt password hashing
- **Helmet** for HTTP security headers
- **Rate limiting** (100 req/min via @nestjs/throttler)
- **Validation** with class-validator (whitelist + forbidNonWhitelisted)
- **Role-based access** (PARENT, CHILD_DEVICE, GATEWAY)
- **Encrypted token storage** (AES-256-CBC for OAuth tokens)
- **Gateway token auth** for router/Raspberry Pi communication
- **Audit logging** for all enforcement actions

## Deployment Guide

### Production Checklist

1. **Environment variables**: Copy `.env.example` to `.env` and set all values. **Never use defaults in production.**
   - Generate 64-char random strings for `JWT_SECRET` and `JWT_REFRESH_SECRET`
   - Set `ENCRYPTION_KEY` to exactly 32 characters
   - Configure `MICROSOFT_OAUTH_*` for Xbox integration
   - Set `FCM_SERVER_KEY` for push notifications
   - Set `NODE_ENV=production`

2. **Database**: Use a managed PostgreSQL service (AWS RDS, Supabase, Neon) or self-host with SSL enabled.
   - Run `npx prisma migrate deploy` on every deployment
   - Enable connection pooling (PgBouncer or Prisma Accelerate)

3. **Redis**: Use a managed Redis service (AWS ElastiCache, Upstash) or self-host with persistence enabled.
   - BullMQ requires Redis for command delivery queues
   - Configure maxmemory-policy to `noeviction`

4. **Docker deployment**:
   ```bash
   # Build and push image
   docker build -t parental-control-backend .
   docker push your-registry/parental-control-backend

   # On server
   docker-compose -f docker-compose.prod.yml up -d
   ```

5. **Health checks**: The server exposes `/` with a basic response. Add a health endpoint if needed.

6. **SSL/TLS**: Use a reverse proxy (nginx, Caddy, AWS ALB) for HTTPS termination. Never expose the app directly.

7. **Monitoring**: 
   - Enable Prisma Query logging in development
   - Use `@nestjs/terminus` for health checks (recommended)
   - Monitor BullMQ queue status via `CommandQueueService.getQueueStatus()`

8. **Scaling**:
   - The app is stateless (JWT tokens, no server-side sessions)
   - Scale horizontally behind a load balancer
   - Ensure all instances share the same Redis and PostgreSQL

### Database Schema

The Prisma schema defines 15 models with the following relationships:
- `User` → `Child[]`, `Device[]`, `Session[]`, `Gateway[]`, `OAuthAccount[]`, `NotificationEvent[]`, `AuditLog[]`, `Subscription?`
- `Child` → `Device[]`, `Rule[]`, `Session[]`, `UsageLog[]`
- `Device` → `Session[]`, `UsageLog[]`, `Command[]`
- `Command` → `CommandAck[]`
- `Gateway` → `Device[]`

Run `npx prisma studio` to explore the database visually.

### Enforcement Flow

```
Parent starts session → SessionsService.start()
  → Check daily limit (RulesService)
  → Create session record
  → EnforcementService.blockDevice() or syncRules()
    → Select adapter by device.controlMethod
    → AndroidAgentAdapter: create Command + enqueue to BullMQ
    → IosScreenTimeAdapter: create Command (requires Apple entitlement)
    → XboxAdapter: check Microsoft OAuth, fallback to gateway
    → NetworkGatewayAdapter: block internet via gateway
    → MockAdapter: return success (dev/test only)

Scheduler (every minute)
  → Check active sessions → expire if remaining <= 0
  → Check bedtime rules → block devices at bedtime
  → Send 10-minute warning notifications
  → Log all actions to AuditLog

Child Agent (polling)
  → GET /child/commands → receive pending commands
  → POST /child/command-ack → acknowledge command
  → POST /child/usage-log → report app usage
  → POST /child/status → report online status + active app
  → POST /child/request-more-time → request extension
```

## DNS Filtering

### Architecture

```
Device → DNS Server (port 53) → Backend (/dns/policy/check) → ALLOW/BLOCK
                                        ↓
                              Redis Cache (30s TTL)
                                        ↓
                              DnsQueryLog (PostgreSQL)
```

### Backend Endpoint

```
GET /dns/policy/check?sourceIp=192.168.1.100&domain=youtube.com
```

Response:
```json
{
  "action": "BLOCK",
  "blockIp": "0.0.0.0",
  "reason": "DOMAIN_BLOCKED"
}
```

### Policy Logic

1. Find device by `sourceIp` (matches `Device.ipAddress` or `Device.dnsSourceIp`)
2. No device → **ALLOW**
3. Device status `BLOCKED` → **BLOCK** (reason: `MANUAL_BLOCK`)
4. Active session expired → **BLOCK** (reason: `TIME_LIMIT_EXCEEDED`)
5. Domain in `BlockedDomain` table → **BLOCK** (reason: `DOMAIN_BLOCKED`)
6. Otherwise → **ALLOW**

Domain matching checks parent domains too: `www.youtube.com` also matches `youtube.com`.

### DNS Server (`dns-service/`)

A standalone Node.js DNS server using `dns2`:

- Listens on port 53 (UDP + TCP)
- Forwards to upstream resolvers (1.1.1.1, 8.8.8.8) on ALLOW
- Returns `0.0.0.0` (A) / `::` (AAAA) on BLOCK
- Fail-open: if backend is unreachable, ALLOW by default

```bash
# Start DNS service
cd dns-service
npm install
cp .env.example .env
npm run dev

# Test
nslookup youtube.com 127.0.0.1
nslookup google.com 127.0.0.1
```

### Blocked Domain Management

Add blocked domains directly via Prisma or a future admin endpoint:

```sql
INSERT INTO blocked_domains (id, domain, category) VALUES (gen_random_uuid(), 'youtube.com', 'streaming');
INSERT INTO blocked_domains (id, domain, category) VALUES (gen_random_uuid(), 'tiktok.com', 'social');
```

### Device DNS Configuration

Set `dnsSourceIp` on each device to the IP the DNS server sees (the device's LAN IP):

```sql
UPDATE devices SET dns_source_ip = '192.168.1.100', dns_configured = true WHERE id = 'device-uuid';
```

Then configure the device/router to use the DNS server as its primary DNS.

## License

UNLICENSED — Private project
