-- Task 27b: dietary facts about a whole business. More values later: ALTER TYPE "Dietary" ADD VALUE.
CREATE TYPE "Dietary" AS ENUM ('gluten_free');

ALTER TABLE "Business" ADD COLUMN "dietary" "Dietary"[] DEFAULT ARRAY[]::"Dietary"[];

CREATE INDEX "Business_dietary_idx" ON "Business" USING GIN ("dietary");
