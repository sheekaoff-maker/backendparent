-- Adds IPv6 device tracking, closing the "IPv6 bypasses enforcement" gap
-- from the 2026-07-20 network enforcement audit. Additive only — no
-- existing column touched, safe on the live DB, no data migration needed
-- (existing rows just get ipv6_address = NULL, meaning "no IPv6 seen yet",
-- same semantics as ip_address already has for v4).

ALTER TABLE "devices"
  ADD COLUMN IF NOT EXISTS "ipv6_address" TEXT;
