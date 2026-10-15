import { Module } from "@nestjs/common";
import { PricingController } from "./pricing.controller.js";
import { PricingRepository } from "./pricing.repository.js";

@Module({
  controllers: [PricingController],
  providers: [PricingRepository],
})
export class PricingModule {}
