/*
  Warnings:

  - The values [BOT_JOINED,WAITING_FIRST_PHOTO,GOT_FIRST_AN,INVITED_FRIEND_1,INVITED_FRIENDS_3,FIRST_PAID] on the enum `UserFunnelAction` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `botBlocked` on the `User` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserFunnelAction_new" AS ENUM ('START', 'ONBOARDING_COMPLETE', 'ANALYSIS_START', 'ANALYSIS_COMPLETE', 'SUBSCRIPTION_PURCHASE', 'REFERRAL_INVITE');
ALTER TABLE "User" ALTER COLUMN "funnelAction" TYPE "UserFunnelAction_new" USING ("funnelAction"::text::"UserFunnelAction_new");
ALTER TYPE "UserFunnelAction" RENAME TO "UserFunnelAction_old";
ALTER TYPE "UserFunnelAction_new" RENAME TO "UserFunnelAction";
DROP TYPE "UserFunnelAction_old";
COMMIT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "botBlocked",
ADD COLUMN     "botBlockedAt" TIMESTAMP(3),
ADD COLUMN     "isBotBlocked" BOOLEAN NOT NULL DEFAULT false;
