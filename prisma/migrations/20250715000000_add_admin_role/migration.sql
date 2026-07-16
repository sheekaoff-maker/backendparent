-- Add ADMIN role for elevated/global-write endpoints (e.g. domain classification).
-- Enum value additions must run outside a transaction and in their own migration.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN';
