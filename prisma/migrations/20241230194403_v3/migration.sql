/*
  Warnings:

  - Made the column `userPhone` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `deliveryAddress` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `deliveryFee` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Area" ALTER COLUMN "restaurantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "userPhone" SET NOT NULL,
ALTER COLUMN "userPhone" SET DEFAULT '',
ALTER COLUMN "deliveryAddress" SET NOT NULL,
ALTER COLUMN "deliveryAddress" SET DEFAULT '',
ALTER COLUMN "deliveryFee" SET NOT NULL;

-- AlterTable
ALTER TABLE "Restaurant" ALTER COLUMN "bannerImg" DROP NOT NULL;
