-- Router Integration Engine: detected-router metadata (per gateway) and a
-- durable command queue for gateway-agent to execute router-vendor actions
-- against it. Fully additive — new enums + tables only, reuses the existing
-- "command_status" enum's values (PENDING/DELIVERED/ACKNOWLEDGED/FAILED) so
-- there is no new status vocabulary to keep in sync.

CREATE TYPE "RouterIntegrationStatus" AS ENUM ('OFFICIAL_API', 'GUIDE_ONLY', 'UNDETECTED');
CREATE TYPE "RouterDetectionMethod" AS ENUM ('UPNP', 'SSDP', 'MDNS', 'DHCP_FINGERPRINT', 'HTTP_HEADER', 'OUI_LOOKUP', 'MANUAL');
CREATE TYPE "RouterCommandType" AS ENUM (
  'DETECT', 'TEST_CONNECTION', 'CHANGE_DNS', 'PAUSE_DEVICE', 'RESUME_DEVICE',
  'DISCONNECT_CLIENT', 'APPLY_FIREWALL_RULE', 'REMOVE_FIREWALL_RULE',
  'BLOCK_MAC', 'UNBLOCK_MAC', 'END_GAMING_SESSION'
);

CREATE TABLE IF NOT EXISTS "detected_routers" (
  "id" TEXT NOT NULL,
  "gateway_id" TEXT NOT NULL,
  "vendor" TEXT,
  "model" TEXT,
  "firmware_version" TEXT,
  "plugin_id" TEXT,
  "integration_status" "RouterIntegrationStatus" NOT NULL DEFAULT 'UNDETECTED',
  "detection_method" "RouterDetectionMethod",
  "confidence" INTEGER,
  "mac_oui" TEXT,
  "ip_address" TEXT,
  "hostname" TEXT,
  "admin_credentials_encrypted" TEXT,
  "last_detected_at" TIMESTAMP(3),
  "last_tested_at" TIMESTAMP(3),
  "last_test_result" BOOLEAN,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "detected_routers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "detected_routers_gateway_id_key" ON "detected_routers" ("gateway_id");

CREATE TABLE IF NOT EXISTS "router_commands" (
  "id" TEXT NOT NULL,
  "gateway_id" TEXT NOT NULL,
  "device_id" TEXT,
  "type" "RouterCommandType" NOT NULL,
  "payload" TEXT,
  "status" "CommandStatus" NOT NULL DEFAULT 'PENDING',
  "result_data" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "delivered_at" TIMESTAMP(3),
  "acked_at" TIMESTAMP(3),
  CONSTRAINT "router_commands_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "router_commands_gateway_id_status_idx" ON "router_commands" ("gateway_id", "status");
