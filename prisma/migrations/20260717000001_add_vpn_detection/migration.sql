-- Layer 5: per-device VPN-blocking toggle (admin enable/disable) and a log of
-- every VPN-signature detection reported by the gateway agent.

ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "vpn_block_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "vpn_detection_logs" (
  "id" TEXT NOT NULL,
  "gateway_id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "detail" TEXT,
  "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vpn_detection_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vpn_detection_logs_device_id_idx" ON "vpn_detection_logs" ("device_id");
CREATE INDEX IF NOT EXISTS "vpn_detection_logs_gateway_id_detected_at_idx" ON "vpn_detection_logs" ("gateway_id", "detected_at");
