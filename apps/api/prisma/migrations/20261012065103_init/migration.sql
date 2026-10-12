CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "PlaceType" AS ENUM ('country', 'region', 'city', 'town', 'village', 'neighbourhood');

-- CreateEnum
CREATE TYPE "PlaceStatus" AS ENUM ('live', 'soon');

-- CreateEnum
CREATE TYPE "KindStatus" AS ENUM ('active', 'hidden');

-- CreateEnum
CREATE TYPE "Template" AS ENUM ('menu', 'booking', 'shop', 'portfolio', 'listing', 'schedule', 'quote', 'donate', 'tracker', 'pass', 'builder');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('example', 'basic', 'verified', 'darb');

-- CreateEnum
CREATE TYPE "BusinessSource" AS ENUM ('seed', 'self', 'claimed');

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('draft', 'published', 'suspended');

-- CreateEnum
CREATE TYPE "ClaimMethod" AS ENUM ('phone', 'documents');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('owner', 'staff');

-- CreateTable
CREATE TABLE "Place" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "PlaceType" NOT NULL,
    "parentId" UUID,
    "path" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "aliases" TEXT[],
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "point" geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography) STORED,
    "boundary" geography(MultiPolygon,4326),
    "population" INTEGER,
    "cbsCode" TEXT,
    "status" "PlaceStatus" NOT NULL DEFAULT 'soon',

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "tagline" JSONB NOT NULL,
    "accent" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kind" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "sectorId" UUID NOT NULL,
    "parentKindId" UUID,
    "name" JSONB NOT NULL,
    "synonyms" JSONB NOT NULL,
    "template" "Template" NOT NULL,
    "contentSchema" JSONB NOT NULL,
    "attributes" TEXT[],
    "icon" TEXT,
    "order" INTEGER NOT NULL,
    "status" "KindStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "Kind_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "tagline" JSONB NOT NULL,
    "primaryKindId" UUID NOT NULL,
    "placeId" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "point" geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography) STORED,
    "address" JSONB NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "website" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "hours" JSONB NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "experience" JSONB NOT NULL,
    "tier" "Tier" NOT NULL,
    "apps" JSONB NOT NULL DEFAULT '{}',
    "source" "BusinessSource" NOT NULL,
    "status" "BusinessStatus" NOT NULL DEFAULT 'draft',
    "brandId" UUID,
    "organizationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessKind" (
    "businessId" UUID NOT NULL,
    "kindId" UUID NOT NULL,

    CONSTRAINT "BusinessKind_pkey" PRIMARY KEY ("businessId","kindId")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "clerkOrgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'he',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "OrgRole" NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("organizationId","userId")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "method" "ClaimMethod" NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Place_slug_key" ON "Place"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Place_cbsCode_key" ON "Place"("cbsCode");

-- CreateIndex
CREATE INDEX "Place_path_idx" ON "Place"("path");

-- CreateIndex
CREATE INDEX "Place_status_idx" ON "Place"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_slug_key" ON "Sector"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Kind_slug_key" ON "Kind"("slug");

-- CreateIndex
CREATE INDEX "Kind_sectorId_idx" ON "Kind"("sectorId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "Business_primaryKindId_idx" ON "Business"("primaryKindId");

-- CreateIndex
CREATE INDEX "Business_status_idx" ON "Business"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Business_placeId_slug_key" ON "Business"("placeId", "slug");

-- CreateIndex
CREATE INDEX "BusinessKind_kindId_idx" ON "BusinessKind"("kindId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_clerkOrgId_key" ON "Organization"("clerkOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kind" ADD CONSTRAINT "Kind_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kind" ADD CONSTRAINT "Kind_parentKindId_fkey" FOREIGN KEY ("parentKindId") REFERENCES "Kind"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_primaryKindId_fkey" FOREIGN KEY ("primaryKindId") REFERENCES "Kind"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessKind" ADD CONSTRAINT "BusinessKind_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessKind" ADD CONSTRAINT "BusinessKind_kindId_fkey" FOREIGN KEY ("kindId") REFERENCES "Kind"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Place_point_idx" ON "Place" USING GIST ("point");
CREATE INDEX "Business_point_idx" ON "Business" USING GIST ("point");
