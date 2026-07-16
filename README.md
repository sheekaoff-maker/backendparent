<div align="center">

# 🛡️ GuardTime — Backend API

**Production-ready NestJS backend for the GuardTime parental control platform.**

[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)](https://docker.com)

[Modules](#-modules) · [Getting Started](#-getting-started) · [API Reference](#-api-reference) · [DNS Filtering](#-dns-filtering) · [Security](#-security) · [Deployment](#-deployment)

</div>

---

## 📖 Overview

This is the central API for GuardTime Parent — a smart parental control platform that manages screen time and internet access across phones, tablets, gaming consoles, smart TVs, and PCs.

The backend handles authentication, device management, session enforcement, real-time DNS filtering, platform-specific control adapters, scheduled jobs, push notifications, and a full audit trail — all in a single production-ready NestJS application.

---

## 🧩 Modules

| Module | Description |
|--------|-------------|
| **Auth** | JWT access + refresh tokens, bcrypt hashing, account lockout, role-based guards |
| **Parents** | Parent profile CRUD and subscription management |
| **Children** | Child profile CRUD — name, avatar, age, default limits |
| **Devices** | Device registry with 13 device types and 8 control methods |
| **Rules** | Daily limits, bedtime, school time, weekend mode, blocked apps/categories |
| **Sessions** | Start / pause / resume / extend / stop / expire with remaining-time tracking |
| **UsageLogs** | Receive and aggregate daily + weekly usage reports |
| **Enforcement** | Adapter pattern — Android agent, iOS Screen Time, Xbox, Network Gateway, Mock |
| **ChildAgent** | Agent polling endpoints — commands, rules, usage logs, time requests |
| **Gateway** | Register, pair, and communicate with home router / Raspberry Pi agents |
| **OAuth** | Microsoft OAuth flow with AES-256-CBC encrypted token storage |
| **Notifications** | FCM HTTP v1 push + in-app notification centre |
| **Push** | Firebase Cloud Messaging with push token registry |
| **Reports** | Per-child and per-device usage reports (daily / weekly) |
| **Scheduler** | Every-minute cron: session expiry, bedtime enforcement, bypass detection |
| **Audit** | Append-only audit log for all enforcement and admin actions |
| **Queue** | BullMQ command delivery queue with retry and acknowledgement tracking |
| **DnsPolicy** | Real-time DNS ALLOW/BLOCK decisions with 30s Redis cache |
| **Categories** | Per-child category blocks — GAMING, STREAMING, SOCIAL, ADULT, CUSTOM |
| **PlatformSupport** | Honest device support matrix + vendor setup guides |
| **OfflineControl** | Vendor-assisted offline checklist + setup guide delivery |
| **Protection** | Per-device protection score (0–100) with bypass detection and escalation |
| **DeviceHealth** | Device online/offline status and health monitoring |
| **Health** | Liveness and readiness endpoints for load balancer health checks |
| **Common** | Shared guards, filters, interceptors, Prisma service, encryption |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Docker + Docker Compose (optional)

### Local Development

```bash
# 1. Clone and install
git clone https://github.com/sheekaoff-maker/backendparent.git
cd backendparent

npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — minimum required: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY

# 3. Set up database
npx prisma generate
npx prisma migrate dev

# 4. Start development server (hot reload)
npm run start:dev
```

The API runs at `http://localhost:3000`. Swagger UI at `http://localhost:3000/api/docs`.

### Docker Compose

Starts PostgreSQL, Redis, the NestJS API, and a mock gateway agent together.

```bash
cp .env.example .env   # edit values as needed

docker-compose up -d

# View logs
docker-compose logs -f backend

# Run a migration inside the container
docker-compose exec backend npx prisma migrate deploy
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env`. The application refuses to start if required secrets are missing or too short.

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `DIRECT_URL` | Non-pooled URL for migrations | — |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_URL` | Full Redis URL (overrides host/port) | — |
| `JWT_SECRET` | Access token secret (≥ 32 chars) | — |
| `JWT_REFRESH_SECRET` | Refresh token secret (≥ 32 chars, different) | — |
| `JWT_EXPIRATION` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRATION` | Refresh token TTL | `7d` |
| `ENCRYPTION_KEY` | AES-256 key for OAuth tokens (exactly 32 chars) | — |
| `CORS_ORIGINS` | Comma-separated allowed origins | — |
| `MICROSOFT_OAUTH_CLIENT_ID` | Xbox Microsoft OAuth | Optional |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | Xbox Microsoft OAuth | Optional |
| `MICROSOFT_OAUTH_REDIRECT_URI` | OAuth callback URI | Optional |
| `FCM_PROJECT_ID` | Firebase project ID | Optional |
| `FCM_CLIENT_EMAIL` | Firebase service account email | Optional |
| `FCM_PRIVATE_KEY` | Firebase service account private key | Optional |
| `STRICT_MODE` | Block DoH/VPN resolvers | `false` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |

---

## 📡 API Reference

Full interactive documentation: **`http://localhost:3000/api/docs`** (Swagger UI)

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register a parent account |
| POST | `/auth/login` | Login and receive access + refresh tokens |
| POST | `/auth/refresh` | Exchange a refresh token for a new pair |
| POST | `/auth/logout` | Invalidate the current refresh token |

### Children & Devices

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `/children` | List or create child profiles |
| GET / PATCH / DELETE | `/children/:id` | Read, update, or delete a child |
| GET / POST | `/devices` | List or register devices |
| GET / PATCH / DELETE | `/devices/:id` | Read, update, or delete a device |
| POST | `/devices/:id/internet-lock` | Full Internet Lock — blocks all traffic |
| POST | `/devices/:id/internet-unlock` | Restore normal policy |
| GET / POST | `/devices/:id/schedule` | Auto-block schedule (bedtime + daily limit) |
| GET | `/devices/:id/protection-score` | 0–100 protection score |
| GET | `/devices/:id/insights` | Full dashboard payload with recommendations |

### Sessions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/sessions/start` | Start a timed gaming session |
| POST | `/sessions/:id/pause` | Pause the session |
| POST | `/sessions/:id/resume` | Resume a paused session |
| POST | `/sessions/:id/extend` | Extend remaining time |
| POST | `/sessions/:id/stop` | Stop the session immediately |
| GET | `/sessions/active` | List all active sessions |
| GET | `/sessions/history` | Paginated session history |

### DNS Policy

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dns/policy/check?sourceIp=&domain=` | Real-time ALLOW / BLOCK decision |

### Rules & Enforcement

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `/rules` | List or create rules |
| PATCH / DELETE | `/rules/:id` | Update or delete a rule |
| POST | `/enforcement/block` | Block a device |
| POST | `/enforcement/unblock` | Unblock a device |
| POST | `/enforcement/sync` | Sync rules to a device |

### Child Agent Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/child/register-device` | Register agent from the child device |
| GET | `/child/rules` | Poll pending rules |
| GET | `/child/commands` | Poll pending commands |
| POST | `/child/command-ack` | Acknowledge a command |
| POST | `/child/usage-log` | Report app usage |
| POST | `/child/request-more-time` | Request a time extension |
| POST | `/child/status` | Report online status + active app |

### Gateway

| Method | Path | Description |
|--------|------|-------------|
| POST | `/gateway/register` | Register a new gateway |
| POST | `/gateway/pair` | Pair and activate a gateway |
| GET | `/gateway/devices` | List devices behind this gateway |
| POST | `/gateway/block` | Block a device via gateway |
| POST | `/gateway/unblock` | Unblock a device via gateway |

### Admin — Blocklists

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `/admin/blocklists/domains` | List or add blocked domains |
| POST | `/admin/blocklists/domains/bulk` | Bulk-import blocked domains |
| DELETE | `/admin/blocklists/domains/:id` | Remove a blocked domain |
| GET / POST | `/admin/blocklists/children/:childId/categories` | Child category blocks |
| GET | `/admin/domains/unknown` | Unclassified domains from real traffic |
| POST | `/admin/domains/classify` | Classify a domain into a category |

### Platform Support

| Method | Path | Description |
|--------|------|-------------|
| GET | `/platform-support/matrix` | Full device support matrix |
| GET | `/platform-support/matrix/:deviceType` | Support info for one device type |
| GET | `/platform-support/guides` | All vendor setup guides |
| GET | `/platform-support/guides/:platform` | Guide for PlayStation / Nintendo / Xbox / Smart TV / Router |

---

## 🌐 DNS Filtering

### How It Works

```
Device ──DNS query──▶ DNS Service (port 53)
                          │
                    ┌─────▼──────────────────────┐
                    │  GET /dns/policy/check      │
                    │  ?sourceIp=192.168.1.x      │
                    │  &domain=youtube.com        │
                    └─────┬──────────────────────┘
                          │
                  ┌───────▼────────┐
                  │  Redis Cache   │  30s TTL
                  └───────┬────────┘
                          │ cache miss
                  ┌───────▼────────┐
                  │  Policy Engine │
                  │  (PostgreSQL)  │
                  └───────┬────────┘
                          │
                    ALLOW ──▶ forward to 1.1.1.1
                    BLOCK ──▶ return 0.0.0.0
```

### Policy Decision Order

1. Unknown source IP → **ALLOW**
2. Device status `BLOCKED` → **BLOCK** (reason: `MANUAL_BLOCK`)
3. `internetLocked = true` → **BLOCK** (reason: `INTERNET_LOCKED`)
4. STRICT MODE: known DoH/VPN resolver → **BLOCK** (reason: `STRICT_MODE_DOH`)
5. Domain or parent domain in `BlockedDomain` table → **BLOCK** (reason: `DOMAIN_BLOCKED`)
6. Active session expired → **BLOCK** (reason: `TIME_LIMIT_EXCEEDED`)
7. Default → **ALLOW**

### STRICT MODE

Set `STRICT_MODE=true` to block well-known DNS-over-HTTPS and public resolver endpoints before any other rule. This prevents children from escaping DNS filtering by switching to a hardcoded resolver.

Blocked in strict mode: `dns.google`, `cloudflare-dns.com`, `one.one.one.one`, `nextdns.io`, `doh.opendns.com`, `dns.quad9.net`, and their subdomains.

---

## 🔒 Security

| Layer | Implementation |
|-------|----------------|
| **Authentication** | JWT access (15 min) + refresh (7 day), httpOnly cookies in prod |
| **Password hashing** | bcrypt with 12 salt rounds |
| **Account lockout** | 5 failed logins → 15-minute lockout |
| **Rate limiting** | 5/min login, 10/min register, 100/min general (per IP) |
| **HTTP headers** | Helmet — CSP, HSTS, X-Frame-Options, etc. |
| **Input validation** | `class-validator` whitelist — unknown fields are rejected |
| **OAuth token storage** | AES-256-CBC encrypted at rest |
| **Role-based access** | PARENT · CHILD_DEVICE · GATEWAY · ADMIN guards |
| **Bypass detection** | Flags devices that stop querying DNS while locked |
| **Audit trail** | Every enforcement and admin action logged to `AuditLog` |

---

## 🗂 Database Schema

20 Prisma models, PostgreSQL 16. Key relationships:

```
User (Parent)
 ├── Child[]
 │    ├── Device[]
 │    │    ├── Session[]
 │    │    ├── UsageLog[]
 │    │    └── Command[] ──▶ CommandAck[]
 │    ├── Rule[]
 │    └── CategoryBlock[]
 ├── Gateway[]
 ├── OAuthAccount[]
 ├── NotificationEvent[]
 ├── AuditLog[]
 ├── Subscription
 └── PushToken[]
```

Run `npx prisma studio` to browse the database in a local UI.

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# Specific test file
npx jest test/sessions.spec.ts
npx jest test/enforcement.spec.ts
```

Test coverage includes session time calculation, daily limit enforcement, adapter selection, Android command creation, iOS rule sync, gateway fallback, offline console behaviour, and scheduler expiration logic.

---

## 🚢 Deployment

### Railway

The repo ships with `railway.toml`. Connect to a Railway project, add environment variables, and Railway will build from the Dockerfile automatically.

```bash
# Deploy via Railway CLI
railway up
```

### Docker

```bash
# Build image
docker build -t guardtime-backend .

# Run with environment file
docker run --env-file .env -p 3000:3000 guardtime-backend
```

The Dockerfile uses a two-stage build (builder + runner) to produce a minimal production image. The entry command runs `prisma migrate deploy` before starting the server so deployments are always in sync with the schema.

### Production Checklist

- [ ] Generate a 64-character random `JWT_SECRET` and `JWT_REFRESH_SECRET` (different values)
- [ ] Set `ENCRYPTION_KEY` to exactly 32 characters
- [ ] Set `NODE_ENV=production`
- [ ] Set `CORS_ORIGINS` to your production frontend URLs
- [ ] Use a managed PostgreSQL service with SSL and automated backups
- [ ] Use a managed Redis service with `maxmemory-policy noeviction`
- [ ] Terminate TLS at a reverse proxy (nginx, Caddy, AWS ALB) — never expose Node directly
- [ ] Enable `STRICT_MODE=true` in production
- [ ] Configure FCM credentials for push notifications

---

## 📜 Scripts

```bash
npm run start:dev      # Development server with hot reload
npm run start:prod     # Production server from compiled dist
npm run build          # Compile TypeScript
npm run lint           # ESLint with auto-fix
npm test               # Jest unit tests
npm run test:cov       # Tests with coverage
npm run prisma:migrate # Run a new migration
npm run prisma:studio  # Open Prisma Studio
npm run docker:up      # docker-compose up -d
npm run docker:down    # docker-compose down
```

---

## 📄 License

Private — All rights reserved. Not for redistribution.
