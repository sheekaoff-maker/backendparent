-- Push notification device tokens (FCM). One row per device/registration.
CREATE TABLE IF NOT EXISTS "push_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_tokens_token_key" ON "push_tokens" ("token");
CREATE INDEX IF NOT EXISTS "push_tokens_user_id_idx" ON "push_tokens" ("user_id");

ALTER TABLE "push_tokens"
  ADD CONSTRAINT "push_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
