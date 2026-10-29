-- AlterTable
ALTER TABLE "areas" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "googlePlaceId" TEXT,
ADD COLUMN     "verification" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "businesses_googlePlaceId_key" ON "businesses"("googlePlaceId");

