-- Add from the street: admin captures join the /join queue (source field), with who added them
-- and the phone's own id so a retried upload never makes a second draft.

-- AlterEnum
ALTER TYPE "JoinSource" ADD VALUE 'field';

-- AlterTable
ALTER TABLE "JoinRequest" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "createdById" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "JoinRequest_clientId_key" ON "JoinRequest"("clientId");

-- CreateIndex
CREATE INDEX "JoinRequest_createdById_createdAt_idx" ON "JoinRequest"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

