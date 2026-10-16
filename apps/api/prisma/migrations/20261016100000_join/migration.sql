-- Join: the /join form's requests, and the card fields on businesses (links, logo, card style).
-- CreateEnum
CREATE TYPE "JoinSource" AS ENUM ('lookup', 'manual');

-- CreateEnum
CREATE TYPE "JoinStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "cardStyle" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "links" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "logo" JSONB;

-- CreateTable
CREATE TABLE "JoinRequest" (
    "id" UUID NOT NULL,
    "businessId" UUID,
    "businessName" JSONB NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerPhone" TEXT NOT NULL,
    "ownerEmail" TEXT,
    "note" TEXT,
    "locale" TEXT NOT NULL,
    "source" "JoinSource" NOT NULL,
    "lookup" JSONB,
    "status" "JoinStatus" NOT NULL DEFAULT 'pending',
    "rejectReason" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "JoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JoinRequest_status_createdAt_idx" ON "JoinRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "JoinRequest_businessId_idx" ON "JoinRequest"("businessId");

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

