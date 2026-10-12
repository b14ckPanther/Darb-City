import { Controller } from "@nestjs/common";
import { contract } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { TaxonomyRepository } from "./taxonomy.repository.js";

@Controller()
export class TaxonomyController {
  constructor(private readonly taxonomy: TaxonomyRepository) {}

  @TsRestHandler(contract.taxonomy)
  handler() {
    return tsRestHandler(contract.taxonomy, {
      get: async () => ({ status: 200, body: await this.taxonomy.tree() }),
    });
  }
}
