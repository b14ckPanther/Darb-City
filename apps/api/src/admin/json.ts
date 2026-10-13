import type { Prisma } from "../generated/prisma/client.js";

/** Validated DTO values are plain JSON already; this tells Prisma so. */
export const json = (value: unknown) => value as Prisma.InputJsonValue;
