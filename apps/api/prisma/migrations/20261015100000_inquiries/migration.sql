-- Inquiries: the /contact form's messages (the admin inbox).
-- CreateEnum
CREATE TYPE "InquiryTopic" AS ENUM ('general', 'join', 'plan', 'other');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('new', 'handled');

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "businessName" TEXT,
    "topic" "InquiryTopic" NOT NULL,
    "plan" TEXT,
    "message" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "ipHash" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'new',
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inquiry_status_createdAt_idx" ON "Inquiry"("status", "createdAt");

