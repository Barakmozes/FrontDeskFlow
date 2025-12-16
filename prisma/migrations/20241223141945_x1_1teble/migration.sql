/*
  Warnings:

  - You are about to drop the column `createdByUserId` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Waitlist` table. All the data in the column will be lost.
  - Added the required column `userEmail` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userEmail` to the `Waitlist` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_userId_fkey";

-- DropForeignKey
ALTER TABLE "Waitlist" DROP CONSTRAINT "Waitlist_userId_fkey";

-- DropIndex
DROP INDEX "Reservation_userId_idx";

-- DropIndex
DROP INDEX "Waitlist_userId_idx";

-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "createdByUserId",
DROP COLUMN "userId",
ADD COLUMN     "createdByUserEmail" TEXT,
ADD COLUMN     "userEmail" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Waitlist" DROP COLUMN "userId",
ADD COLUMN     "userEmail" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Reservation_userEmail_idx" ON "Reservation"("userEmail");

-- CreateIndex
CREATE INDEX "Waitlist_userEmail_idx" ON "Waitlist"("userEmail");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdByUserEmail_fkey" FOREIGN KEY ("createdByUserEmail") REFERENCES "User"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Waitlist" ADD CONSTRAINT "Waitlist_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
