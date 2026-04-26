-- CreateTable
CREATE TYPE "Role" AS ENUM ('PARENT', 'CHILD_DEVICE', 'GATEWAY');

CREATE TYPE "DeviceType" AS ENUM ('ANDROID_PHONE', 'ANDROID_TABLET', 'IPHONE', 'IPAD', 'XBOX', 'PLAYSTATION', 'SMART_TV', 'STREAMING_BOX', 'OTHER');

CREATE TYPE "ControlMethod" AS ENUM ('ANDROID_AGENT', 'IOS_SCREEN_TIME', 'XBOX_ADAPTER', 'NETWORK_GATEWAY', 'MOCK');

CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'BLOCKED', 'PAUSED');

CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'STOPPED', 'EXPIRED', 'VIOLATED');

CREATE TYPE "RuleType" AS ENUM ('DAILY_LIMIT', 'BEDTIME', 'SCHOOL_TIME', 'WEEKEND_MODE', 'REWARD_EXTRA_TIME', 'BLOCKED_APPS', 'BLOCKED_CATEGORIES');

CREATE TYPE "CommandType" AS ENUM ('BLOCK_APPS', 'UNBLOCK_APPS', 'LOCK_DEVICE', 'START_VPN_DNS', 'STOP_VPN_DNS', 'REPORT_USAGE', 'SYNC_RULES');

CREATE TYPE "CommandStatus" AS ENUM ('PENDING', 'DELIVERED', 'ACKNOWLEDGED', 'FAILED');

CREATE TYPE "NotificationType" AS ENUM ('TIME_10_MIN_LEFT', 'TIME_ENDED', 'DEVICE_BLOCKED', 'CHILD_REQUEST_MORE_TIME', 'PARENT_APPROVED', 'PARENT_DENIED');

CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PREMIUM', 'FAMILY');

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PARENT',
    "firstName" TEXT,
    "lastName" TEXT,
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "children" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "age" INTEGER,
    "default_limit_minutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "child_id" TEXT,
    "parent_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "platform" TEXT,
    "mac_address" TEXT,
    "ip_address" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ONLINE',
    "controlMethod" "ControlMethod" NOT NULL DEFAULT 'MOCK',
    "last_seen" TIMESTAMP(3),
    "gateway_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "type" "RuleType" NOT NULL,
    "value" TEXT NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "days_of_week" TEXT,
    "blocked_apps" TEXT[],
    "blocked_categories" TEXT[],
    "extra_minutes" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paused_at" TIMESTAMP(3),
    "resumed_at" TIMESTAMP(3),
    "stopped_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "duration_minutes" INTEGER NOT NULL,
    "remaining_minutes" INTEGER NOT NULL,
    "extended_minutes" INTEGER NOT NULL DEFAULT 0,
    "violated" BOOLEAN NOT NULL DEFAULT false,
    "active_app" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usage_logs" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "app_name" TEXT,
    "category" TEXT,
    "duration_seconds" INTEGER NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commands" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "type" "CommandType" NOT NULL,
    "payload" TEXT,
    "status" "CommandStatus" NOT NULL DEFAULT 'PENDING',
    "delivered_at" TIMESTAMP(3),
    "acked_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "command_acks" (
    "id" TEXT NOT NULL,
    "command_id" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "result_data" TEXT,
    "acked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "command_acks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gateways" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "endpoint" TEXT,
    "paired" BOOLEAN NOT NULL DEFAULT false,
    "paired_at" TIMESTAMP(3),
    "last_seen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gateways_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "device_id" TEXT,
    "child_id" TEXT,
    "session_id" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "sent_via_fcm" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" TEXT,
    "ip_address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "stripe_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE UNIQUE INDEX "gateways_token_key" ON "gateways"("token");

CREATE UNIQUE INDEX "oauth_accounts_provider_provider_user_id_key" ON "oauth_accounts"("provider", "provider_user_id");

CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

CREATE INDEX "usage_logs_device_id_logged_at_idx" ON "usage_logs"("device_id", "logged_at");

CREATE INDEX "usage_logs_child_id_logged_at_idx" ON "usage_logs"("child_id", "logged_at");

CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

ALTER TABLE "children" ADD CONSTRAINT "children_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devices" ADD CONSTRAINT "devices_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "devices" ADD CONSTRAINT "devices_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devices" ADD CONSTRAINT "devices_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "rules" ADD CONSTRAINT "rules_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commands" ADD CONSTRAINT "commands_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "command_acks" ADD CONSTRAINT "command_acks_command_id_fkey" FOREIGN KEY ("command_id") REFERENCES "commands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gateways" ADD CONSTRAINT "gateways_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
