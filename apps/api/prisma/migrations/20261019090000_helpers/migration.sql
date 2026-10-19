-- Darb Helpers: friends who add businesses from their towns. A User applies, an admin approves,
-- pauses or resumes them (audited as entity helper). Additive only: existing rows stay none.

-- CreateEnum
CREATE TYPE "HelperStatus" AS ENUM ('none', 'pending', 'approved', 'paused');

-- AlterEnum
ALTER TYPE "AuditEntity" ADD VALUE 'helper';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "helperAppliedAt" TIMESTAMP(3),
ADD COLUMN     "helperCredit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "helperDecidedAt" TIMESTAMP(3),
ADD COLUMN     "helperName" TEXT,
ADD COLUMN     "helperNote" TEXT,
ADD COLUMN     "helperPhone" TEXT,
ADD COLUMN     "helperPlaceId" UUID,
ADD COLUMN     "helperStatus" "HelperStatus" NOT NULL DEFAULT 'none';

-- CreateIndex
CREATE INDEX "User_helperStatus_helperAppliedAt_idx" ON "User"("helperStatus", "helperAppliedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_helperPlaceId_fkey" FOREIGN KEY ("helperPlaceId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
