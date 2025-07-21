-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserPipelineState" ADD VALUE 'MINI_APP_OPENED';
ALTER TYPE "UserPipelineState" ADD VALUE 'CREATING_HYPOTHESIS';
ALTER TYPE "UserPipelineState" ADD VALUE 'HYPOTHESIS_SENT';
ALTER TYPE "UserPipelineState" ADD VALUE 'HYPOTHESIS_REJECTED';

-- AlterTable
ALTER TABLE "UserInfo" ADD COLUMN     "blockHypothesis" TEXT,
ADD COLUMN     "hypothesisRejectedCount" INTEGER NOT NULL DEFAULT 0;
