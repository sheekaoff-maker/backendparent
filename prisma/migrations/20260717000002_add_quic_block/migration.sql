-- Layer 6: per-device QUIC (HTTP/3, UDP/443) blocking toggle. Defaults to
-- false — QUIC blocking is opt-in per device/policy (or via the gateway's
-- own ENABLE_QUIC_BLOCK_GLOBAL env for a blanket switch), since some sites
-- rely on QUIC and fall back to normal HTTPS only after a delay.

ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "quic_block_enabled" BOOLEAN NOT NULL DEFAULT false;
