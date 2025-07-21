-- CreateEnum
CREATE TYPE "UserPipelineState" AS ENUM ('WELCOME_SENT', 'WAITING_PHOTOS', 'PHOTOS_RECEIVED', 'ANALYSIS_COMPLETED', 'ONBOARDING_COMPLETE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pipelineState" "UserPipelineState";
