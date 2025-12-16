/*
  Warnings:

  - The `status` column on the `Waitlist` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `deliveryAddress` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'CALLED', 'SEATED', 'CANCELLED');

-- DropIndex
DROP INDEX "Reservation_tableId_key";

-- AlterTable
ALTER TABLE "Favorite" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Menu" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "deliveryTime" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "deliveryAddress" SET NOT NULL;

-- AlterTable
ALTER TABLE "Restaurant" ALTER COLUMN "address" SET DEFAULT '27 DrickField, Darwin, Australia';

-- AlterTable
ALTER TABLE "Waitlist" DROP COLUMN "status",
ADD COLUMN     "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING';
