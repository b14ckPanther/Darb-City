import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);
const app = await NestFactory.create(AppModule);
app.enableCors({ origin: config.webOrigin });
app.enableShutdownHooks();
await app.listen(config.port);
