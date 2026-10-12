import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller.js";
import { PlacesModule } from "./places/places.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({ imports: [PrismaModule, PlacesModule], controllers: [HealthController] })
export class AppModule {}
