-- Adds BLOCK_DEVICE/UNBLOCK_DEVICE router command types, closing the
-- "block/unblock only ever waits for the next poll cycle" gap from the
-- 2026-07-20 network enforcement audit: EnforcementService.blockDevice/
-- unblockDevice now also enqueue an explicit router command for a faster
-- convergence path alongside the existing poll cycle. Enum value additions
-- must run outside a transaction and in their own migration.
ALTER TYPE "RouterCommandType" ADD VALUE IF NOT EXISTS 'BLOCK_DEVICE';
ALTER TYPE "RouterCommandType" ADD VALUE IF NOT EXISTS 'UNBLOCK_DEVICE';
