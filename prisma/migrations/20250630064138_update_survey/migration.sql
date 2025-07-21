-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserPipelineState" ADD VALUE 'SURVEY_IN_PROGRESS';
ALTER TYPE "UserPipelineState" ADD VALUE 'WAITING_VOICE_SURVEY';

-- AlterTable
ALTER TABLE "UserInfo" ADD COLUMN     "surveyAnswers" TEXT,
ADD COLUMN     "surveyProgress" INTEGER DEFAULT 0;
