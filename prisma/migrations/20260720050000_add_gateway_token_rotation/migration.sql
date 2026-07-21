-- Adds a token-rotation grace period to gateways, closing the "no way to
-- rotate a leaked/compromised gateway token without breaking an
-- already-deployed gateway-agent" gap from the 2026-07-20 security audit.
-- Additive only — both columns nullable, existing rows get NULL (meaning
-- "never rotated"), no data migration needed.
ALTER TABLE "gateways"
  ADD COLUMN IF NOT EXISTS "previous_token" TEXT,
  ADD COLUMN IF NOT EXISTS "previous_token_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "gateways_previous_token_key" ON "gateways"("previous_token");
