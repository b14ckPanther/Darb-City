import { Module } from "@nestjs/common";
import { PlacesController } from "./places.controller.js";
import { PlacesRepository } from "./places.repository.js";

@Module({ controllers: [PlacesController], providers: [PlacesRepository], exports: [PlacesRepository] })
export class PlacesModule {}
