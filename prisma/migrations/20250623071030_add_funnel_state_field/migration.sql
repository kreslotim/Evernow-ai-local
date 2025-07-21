-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserFunnelAction" ADD VALUE 'BOT_JOINED';
ALTER TYPE "UserFunnelAction" ADD VALUE 'WAITING_FIRST_PHOTO';
ALTER TYPE "UserFunnelAction" ADD VALUE 'GOT_FIRST_AN';
ALTER TYPE "UserFunnelAction" ADD VALUE 'INVITED_FRIEND_1';
ALTER TYPE "UserFunnelAction" ADD VALUE 'INVITED_FRIENDS_3';
ALTER TYPE "UserFunnelAction" ADD VALUE 'FIRST_PAID';
