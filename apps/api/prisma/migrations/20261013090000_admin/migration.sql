-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'status', 'release', 'delete');

-- CreateEnum
CREATE TYPE "AuditEntity" AS ENUM ('place', 'sector', 'kind', 'business');

-- AlterEnum
ALTER TYPE "BusinessSource" ADD VALUE 'admin';

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "editedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Kind" ADD COLUMN     "editedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "editedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SearchDocument" ADD COLUMN     "embedHash" TEXT;

-- AlterTable
ALTER TABLE "Sector" ADD COLUMN     "editedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntity" NOT NULL,
    "entityId" UUID NOT NULL,
    "fields" TEXT[],

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_at_idx" ON "AuditLog"("entityType", "entityId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
