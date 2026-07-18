-- Layer 7: bandwidth limiter policies. A limit can scope to a device, a
-- child (applies to all of that child's devices), or both narrowed further
-- by category; device-scoped rows take priority over child-scoped rows for
-- the same category when resolving a device's effective policy.

CREATE TABLE IF NOT EXISTS "bandwidth_limits" (
  "id" TEXT NOT NULL,
  "parent_id" TEXT NOT NULL,
  "child_id" TEXT,
  "device_id" TEXT,
  "category" "BlockCategory",
  "download_kbps" INTEGER,
  "upload_kbps" INTEGER,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bandwidth_limits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bandwidth_limits_parent_id_idx" ON "bandwidth_limits" ("parent_id");
CREATE INDEX IF NOT EXISTS "bandwidth_limits_child_id_idx" ON "bandwidth_limits" ("child_id");
CREATE INDEX IF NOT EXISTS "bandwidth_limits_device_id_idx" ON "bandwidth_limits" ("device_id");
