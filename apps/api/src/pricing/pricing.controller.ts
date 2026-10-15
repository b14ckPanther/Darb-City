import { Controller } from "@nestjs/common";
import { contract } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { PricingRepository } from "./pricing.repository.js";

@Controller()
export class PricingController {
  constructor(private readonly pricing: PricingRepository) {}

  @TsRestHandler(contract.pricing)
  handler() {
    return tsRestHandler(contract.pricing, {
      get: async () => ({ status: 200, body: await this.pricing.page() }),
    });
  }
}
