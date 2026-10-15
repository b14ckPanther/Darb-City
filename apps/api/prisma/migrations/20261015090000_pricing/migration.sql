-- Pricing: admin-edited plans and page copy (/pricing).
-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('live', 'hidden');

-- AlterEnum
ALTER TYPE "AuditEntity" ADD VALUE 'plan';
ALTER TYPE "AuditEntity" ADD VALUE 'text';

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'live',
    "name" JSONB NOT NULL,
    "tagline" JSONB NOT NULL,
    "monthly" INTEGER,
    "setup" INTEGER,
    "priceNote" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "ctaLabel" JSONB NOT NULL,
    "ctaHref" TEXT NOT NULL,
    "finePrint" JSONB NOT NULL,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteText" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "SiteText_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- CreateIndex
CREATE INDEX "Plan_status_order_idx" ON "Plan"("status", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SiteText_key_key" ON "SiteText"("key");
