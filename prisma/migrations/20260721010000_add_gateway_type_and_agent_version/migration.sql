-- Adds Software Gateway support: a gateway no longer implies a physical
-- router. `gateway_type` distinguishes a gateway-agent enforcing directly on
-- its own host (SOFTWARE_AGENT, default — no router required) from one
-- additionally driving a real router via the Router Integration Engine
-- (ROUTER_PLUGIN). `description` is optional free text set at registration.
-- `agent_version` is reported by gateway-agent itself on its policy poll and
-- stays NULL until an agent build that sends it has connected.
-- Additive only — every existing row defaults to SOFTWARE_AGENT (the
-- previously-only-implicit behavior) with NULL description/agent_version.
DO $$ BEGIN
  CREATE TYPE "GatewayType" AS ENUM ('SOFTWARE_AGENT', 'ROUTER_PLUGIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "gateways"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "gateway_type" "GatewayType" NOT NULL DEFAULT 'SOFTWARE_AGENT',
  ADD COLUMN IF NOT EXISTS "agent_version" TEXT;
