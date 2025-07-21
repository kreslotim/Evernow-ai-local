-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('FUNNEL_ACTION_CHANGE', 'FUNNEL_STATE_CHANGE', 'PIPELINE_STATE_CHANGE');

-- CreateTable
CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "funnelAction" "UserFunnelAction",
    "funnelState" "FunnelState",
    "pipelineState" "UserPipelineState",
    "eventType" "EventType" NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FunnelEvent_userId_idx" ON "FunnelEvent"("userId");

-- CreateIndex
CREATE INDEX "FunnelEvent_eventType_idx" ON "FunnelEvent"("eventType");

-- CreateIndex
CREATE INDEX "FunnelEvent_createdAt_idx" ON "FunnelEvent"("createdAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_userId_createdAt_idx" ON "FunnelEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
