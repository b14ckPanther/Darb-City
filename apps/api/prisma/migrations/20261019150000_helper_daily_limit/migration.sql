-- A helper's own cap on additions and sign readings a day: NULL is the default (150), 0 is no
-- cap, any other number is that cap. Additive: every existing helper keeps the default.
ALTER TABLE "User" ADD COLUMN "helperDailyLimit" INTEGER;
