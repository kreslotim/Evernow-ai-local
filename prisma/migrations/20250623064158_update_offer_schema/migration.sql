/*
  Warnings:

  - You are about to drop the column `description` on the `Offer` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Offer` table. All the data in the column will be lost.
  - The `status` column on the `Offer` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `text` to the `Offer` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Offer" DROP COLUMN "description",
DROP COLUMN "title",
ADD COLUMN     "text" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "OfferStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");
