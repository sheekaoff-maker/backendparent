-- Adds confidence scoring columns to vpn_detection_logs, closing the
-- "binary VPN detection" gap from the 2026-07-20 network enforcement audit
-- (gateway-agent now reports a per-signal weight plus a noisy-OR combined
-- per-device confidence instead of a bare provider name). Additive only —
-- both columns nullable, existing rows get NULL (meaning "recorded before
-- confidence scoring existed"), no data migration needed.

ALTER TABLE "vpn_detection_logs"
  ADD COLUMN IF NOT EXISTS "confidence" INTEGER,
  ADD COLUMN IF NOT EXISTS "overall_confidence" INTEGER;
