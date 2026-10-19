-- The helper app's small moments: the highest milestone a helper was celebrated for (0: none yet)
-- and when the app last told them what went live (NULL until their first visit). Additive.
ALTER TABLE "User" ADD COLUMN "helperMilestone" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "helperSeenAt" TIMESTAMP(3);
