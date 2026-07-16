-- Add MAC as a first-class device type so macOS onboarding is distinct from
-- generic Windows "PC" (different DNS + parental-control flows).
ALTER TYPE "DeviceType" ADD VALUE IF NOT EXISTS 'MAC';
