/*
  Warnings:

  - The values [FEELINGS_RECEIVED] on the enum `UserPipelineState` will be removed. If these variants are still used in the database, this will fail.

*/
-- Обновляем всех пользователей с состоянием FEELINGS_RECEIVED на CREATING_HYPOTHESIS
UPDATE "User" SET "pipelineState" = 'CREATING_HYPOTHESIS' WHERE "pipelineState" = 'FEELINGS_RECEIVED';
UPDATE "FunnelEvent" SET "pipelineState" = 'CREATING_HYPOTHESIS' WHERE "pipelineState" = 'FEELINGS_RECEIVED';

-- AlterEnum
BEGIN;
CREATE TYPE "UserPipelineState_new" AS ENUM ('WELCOME_SENT', 'WAITING_PHOTOS', 'PHOTOS_RECEIVED', 'ANALYSIS_COMPLETED', 'TIMER_STARTED', 'WAITING_FEELINGS', 'MINI_APP_OPENED', 'CREATING_HYPOTHESIS', 'HYPOTHESIS_SENT', 'HYPOTHESIS_REJECTED', 'FINAL_MESSAGE_SENT', 'ONBOARDING_COMPLETE');
ALTER TABLE "User" ALTER COLUMN "pipelineState" TYPE "UserPipelineState_new" USING ("pipelineState"::text::"UserPipelineState_new");
ALTER TABLE "FunnelEvent" ALTER COLUMN "pipelineState" TYPE "UserPipelineState_new" USING ("pipelineState"::text::"UserPipelineState_new");
ALTER TYPE "UserPipelineState" RENAME TO "UserPipelineState_old";
ALTER TYPE "UserPipelineState_new" RENAME TO "UserPipelineState";
DROP TYPE "UserPipelineState_old";
COMMIT;
