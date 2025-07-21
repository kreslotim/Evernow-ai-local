-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserPipelineState" ADD VALUE 'TIMER_STARTED';
ALTER TYPE "UserPipelineState" ADD VALUE 'WAITING_FEELINGS';
ALTER TYPE "UserPipelineState" ADD VALUE 'FEELINGS_RECEIVED';

-- AlterTable
ALTER TABLE "UserInfo" ADD COLUMN     "feelings" TEXT;

-- CreateTable
CREATE TABLE "UserTimer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTimer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserTimer_userId_key" ON "UserTimer"("userId");

-- CreateIndex
CREATE INDEX "UserTimer_userId_idx" ON "UserTimer"("userId");

-- AddForeignKey
ALTER TABLE "UserTimer" ADD CONSTRAINT "UserTimer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
