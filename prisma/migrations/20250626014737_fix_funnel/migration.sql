/*
  Warnings:

  - The values [WAITING_FIRST_PHOTO,GOT_FIRST_AN,INVITED_FRIEND_1,INVITED_FRIENDS_3,FIRST_PAID] on the enum `FunnelState` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FunnelState_new" AS ENUM ('BOT_JOINED', 'FIRST_PHOTO_ANALYSIS', 'FEELINGS_SHARED', 'PSY_TEST_PASSED', 'HYPOTHESIS_RECEIVED', 'INVITED_FRIENDS_7', 'VIDEO_SHARED', 'PAYMENT_MADE', 'FUNNEL_COMPLETED');
ALTER TABLE "User" ALTER COLUMN "funnelState" TYPE "FunnelState_new" USING ("funnelState"::text::"FunnelState_new");
ALTER TABLE "FunnelEvent" ALTER COLUMN "funnelState" TYPE "FunnelState_new" USING ("funnelState"::text::"FunnelState_new");
ALTER TYPE "FunnelState" RENAME TO "FunnelState_old";
ALTER TYPE "FunnelState_new" RENAME TO "FunnelState";
DROP TYPE "FunnelState_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserFunnelAction" ADD VALUE 'FEELINGS_SHARE';
ALTER TYPE "UserFunnelAction" ADD VALUE 'PSY_TEST_COMPLETE';
ALTER TYPE "UserFunnelAction" ADD VALUE 'HYPOTHESIS_RECEIVE';
ALTER TYPE "UserFunnelAction" ADD VALUE 'VIDEO_SHARE';
ALTER TYPE "UserFunnelAction" ADD VALUE 'FUNNEL_COMPLETE';
