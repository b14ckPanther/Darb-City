CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "SearchEntity" AS ENUM ('place', 'kind', 'business');

-- CreateEnum
CREATE TYPE "SearchLane" AS ENUM ('smart', 'instant', 'blocked');

-- CreateTable
CREATE TABLE "SearchDocument" (
    "id" UUID NOT NULL,
    "entityType" "SearchEntity" NOT NULL,
    "entityId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "placePath" TEXT NOT NULL,
    "kindIds" UUID[],
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "tier" "Tier",
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "point" geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography) STORED,
    "nameText" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tsv" tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, "text")) STORED,
    "embedding" vector(512),
    "completeness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchQuery" (
    "id" UUID NOT NULL,
    "normalized" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "intent" JSONB NOT NULL,
    "unmatched" TEXT[],
    "lane" "SearchLane" NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "clickedKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchDocument_placePath_idx" ON "SearchDocument"("placePath");

-- CreateIndex
CREATE UNIQUE INDEX "SearchDocument_entityType_entityId_key" ON "SearchDocument"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "SearchQuery_createdAt_idx" ON "SearchQuery"("createdAt");

CREATE INDEX "SearchDocument_text_trgm_idx" ON "SearchDocument" USING GIN ("text" gin_trgm_ops);
CREATE INDEX "SearchDocument_nameText_trgm_idx" ON "SearchDocument" USING GIN ("nameText" gin_trgm_ops);
CREATE INDEX "SearchDocument_tsv_idx" ON "SearchDocument" USING GIN ("tsv");
CREATE INDEX "SearchDocument_kindIds_idx" ON "SearchDocument" USING GIN ("kindIds");
CREATE INDEX "SearchDocument_point_idx" ON "SearchDocument" USING GIST ("point");
CREATE INDEX "SearchDocument_placePath_pattern_idx" ON "SearchDocument" ("placePath" text_pattern_ops);
CREATE INDEX "Business_attributes_idx" ON "Business" USING GIN ("attributes" jsonb_path_ops);

-- Minutes since midnight of an "HH:MM" time; "24:00" is 1440.
CREATE FUNCTION darb_minutes(t text) RETURNS int IMMUTABLE STRICT LANGUAGE sql AS $$
  SELECT split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int
$$;

-- The intervals that apply on a local date: a dated exception wins over the weekday's hours.
CREATE FUNCTION darb_intervals(hours jsonb, d date) RETURNS jsonb IMMUTABLE LANGUAGE sql AS $$
  SELECT COALESCE(
    (SELECT e -> 'intervals'
       FROM jsonb_array_elements(COALESCE(hours -> 'exceptions', '[]'::jsonb)) AS e
      WHERE e ->> 'date' = to_char(d, 'YYYY-MM-DD')
      LIMIT 1),
    hours -> 'weekly' -> (extract(dow FROM d)::int::text),
    '[]'::jsonb)
$$;

-- The SQL twin of isOpenAt (packages/core/src/hours.ts), in Asia/Jerusalem time.
CREATE FUNCTION darb_open_at(hours jsonb, at timestamptz) RETURNS boolean STABLE LANGUAGE sql AS $$
  WITH m AS (
    SELECT (at AT TIME ZONE 'Asia/Jerusalem')::date AS d,
           (extract(hour FROM at AT TIME ZONE 'Asia/Jerusalem') * 60
            + extract(minute FROM at AT TIME ZONE 'Asia/Jerusalem'))::int AS mins
  )
  SELECT EXISTS (
      SELECT 1 FROM m, jsonb_array_elements(darb_intervals(hours, m.d)) AS i
       WHERE CASE WHEN darb_minutes(i ->> 'close') > darb_minutes(i ->> 'open')
                  THEN m.mins >= darb_minutes(i ->> 'open') AND m.mins < darb_minutes(i ->> 'close')
                  ELSE m.mins >= darb_minutes(i ->> 'open') END)
      OR EXISTS (
      SELECT 1 FROM m, jsonb_array_elements(darb_intervals(hours, m.d - 1)) AS i
       WHERE darb_minutes(i ->> 'close') <= darb_minutes(i ->> 'open')
         AND m.mins < darb_minutes(i ->> 'close'))
$$;
