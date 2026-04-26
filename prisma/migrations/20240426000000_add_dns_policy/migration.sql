-- AlterTable: Add DNS fields to devices
ALTER TABLE "devices" ADD COLUMN "dns_source_ip" TEXT;
ALTER TABLE "devices" ADD COLUMN "dns_configured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "devices" ADD COLUMN "last_dns_seen_at" TIMESTAMP(3);

-- CreateTable: BlockedDomain
CREATE TABLE "blocked_domains" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DnsQueryLog
CREATE TABLE "dns_query_logs" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "source_ip" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dns_query_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blocked_domains_domain_key" ON "blocked_domains"("domain");

-- CreateIndex
CREATE INDEX "dns_query_logs_source_ip_idx" ON "dns_query_logs"("source_ip");

-- CreateIndex
CREATE INDEX "dns_query_logs_createdAt_idx" ON "dns_query_logs"("createdAt");
