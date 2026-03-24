-- CreateTable
CREATE TABLE "security_audit_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" TEXT NOT NULL,
    "actor" TEXT,
    "userId" TEXT,
    "contactId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "meta" TEXT,
    CONSTRAINT "security_audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "security_audit_log_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "security_audit_log_createdAt_idx" ON "security_audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "security_audit_log_userId_idx" ON "security_audit_log"("userId");

-- CreateIndex
CREATE INDEX "security_audit_log_contactId_idx" ON "security_audit_log"("contactId");

-- CreateIndex
CREATE INDEX "security_audit_log_ip_idx" ON "security_audit_log"("ip");

-- CreateIndex
CREATE INDEX "security_audit_log_actor_idx" ON "security_audit_log"("actor");
