-- CreateTable
CREATE TABLE "DiagnosticLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "level" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "telegramId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiagnosticLog_userId_idx" ON "DiagnosticLog"("userId");

-- CreateIndex
CREATE INDEX "DiagnosticLog_component_idx" ON "DiagnosticLog"("component");

-- CreateIndex
CREATE INDEX "DiagnosticLog_level_idx" ON "DiagnosticLog"("level");

-- CreateIndex
CREATE INDEX "DiagnosticLog_createdAt_idx" ON "DiagnosticLog"("createdAt");

-- CreateIndex
CREATE INDEX "DiagnosticLog_userId_component_createdAt_idx" ON "DiagnosticLog"("userId", "component", "createdAt");
