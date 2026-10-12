import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);
const app = await NestFactory.create<NestExpressApplication>(AppModule);
// req.ip is the client's address behind this many proxies (decision 5).
app.set("trust proxy", config.search.trustProxy);
app.enableCors({ origin: config.webOrigin });
app.enableShutdownHooks();
await app.listen(config.port);
