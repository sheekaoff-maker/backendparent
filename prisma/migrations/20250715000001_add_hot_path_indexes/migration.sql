-- Performance: index the DNS-policy hot path and common parent-scoped lookups.
-- The DNS resolver looks up a device by source IP on every cache miss; without
-- these indexes that is a sequential scan on the busiest endpoint in the system.

CREATE INDEX IF NOT EXISTS "devices_ip_address_idx" ON "devices" ("ip_address");
CREATE INDEX IF NOT EXISTS "devices_dns_source_ip_idx" ON "devices" ("dns_source_ip");
CREATE INDEX IF NOT EXISTS "devices_parent_id_idx" ON "devices" ("parent_id");
CREATE INDEX IF NOT EXISTS "devices_gateway_id_mac_address_idx" ON "devices" ("gateway_id", "mac_address");

CREATE INDEX IF NOT EXISTS "sessions_device_id_status_idx" ON "sessions" ("device_id", "status");
CREATE INDEX IF NOT EXISTS "sessions_parent_id_idx" ON "sessions" ("parent_id");

CREATE INDEX IF NOT EXISTS "children_parent_id_idx" ON "children" ("parent_id");
