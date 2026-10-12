import "dotenv/config";
import { loadBrands, loadBusinesses, loadKinds, loadPlaces, loadSectors } from "@darb/seed";
import { loadConfig } from "../config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { loadSeed } from "./load.js";

const prisma = new PrismaService(loadConfig(process.env));
const started = Date.now();
const counts = await loadSeed(prisma, {
  places: loadPlaces(),
  sectors: loadSectors(),
  kinds: loadKinds(),
  brands: loadBrands(),
  businesses: loadBusinesses(),
});
await prisma.$disconnect();
console.log(`Seeded ${JSON.stringify(counts)} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
