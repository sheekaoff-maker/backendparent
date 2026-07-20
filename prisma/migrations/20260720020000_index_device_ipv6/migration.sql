-- Indexes devices.ipv6_address for the DNS-policy hot-path lookup
-- (dns-policy.service.ts's checkPolicy now matches ipAddress OR
-- dnsSourceIp OR ipv6Address). Additive, safe on the live DB.

CREATE INDEX IF NOT EXISTS "devices_ipv6_address_idx" ON "devices" ("ipv6_address");
