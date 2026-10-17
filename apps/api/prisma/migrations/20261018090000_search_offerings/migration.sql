-- Deep search: what each published business offers, searched inside its card.

-- CreateTable
CREATE TABLE "SearchOffering" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "ref" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "label" JSONB NOT NULL,
    "context" JSONB,
    "labelText" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tsv" tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, "text")) STORED,
    "embedHash" TEXT,
    "placePath" TEXT NOT NULL,
    "kindIds" UUID[],
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "dietary" "Dietary"[] DEFAULT ARRAY[]::"Dietary"[],
    "tier" "Tier" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "point" geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography) STORED,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchEmbedding" (
    "hash" TEXT NOT NULL,
    "embedding" vector(512) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchEmbedding_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchOffering_businessId_ref_key" ON "SearchOffering"("businessId", "ref");
CREATE INDEX "SearchOffering_placePath_idx" ON "SearchOffering"("placePath");
CREATE INDEX "SearchOffering_embedHash_idx" ON "SearchOffering"("embedHash");
CREATE INDEX "SearchOffering_text_trgm_idx" ON "SearchOffering" USING GIN ("text" gin_trgm_ops);
CREATE INDEX "SearchOffering_labelText_trgm_idx" ON "SearchOffering" USING GIN ("labelText" gin_trgm_ops);
CREATE INDEX "SearchOffering_tsv_idx" ON "SearchOffering" USING GIN ("tsv");
CREATE INDEX "SearchOffering_kindIds_idx" ON "SearchOffering" USING GIN ("kindIds");
CREATE INDEX "SearchOffering_dietary_idx" ON "SearchOffering" USING GIN ("dietary");
CREATE INDEX "SearchOffering_point_idx" ON "SearchOffering" USING GIST ("point");
CREATE INDEX "SearchOffering_placePath_pattern_idx" ON "SearchOffering" ("placePath" text_pattern_ops);

-- AddForeignKey
ALTER TABLE "SearchOffering" ADD CONSTRAINT "SearchOffering_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
