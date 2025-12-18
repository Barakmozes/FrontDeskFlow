/*
  Warnings:

  - A unique constraint covering the columns `[areaId,tableNumber]` on the table `Table` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Table_tableNumber_key";

-- AlterTable
ALTER TABLE "Restaurant" ALTER COLUMN "address" SET DEFAULT 'rmat hsron 14';

-- CreateIndex
CREATE UNIQUE INDEX "Table_areaId_tableNumber_key" ON "Table"("areaId", "tableNumber");
