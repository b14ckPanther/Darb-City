import { Injectable } from "@nestjs/common";
import { Ajv, type ValidateFunction } from "ajv";

/** Spec §4.3/§4.4: Business.experience is validated against its primary kind's contentSchema. */
@Injectable()
export class ExperienceValidator {
  private readonly ajv = new Ajv({ allErrors: true });
  private readonly cache = new Map<string, ValidateFunction>();

  validate(contentSchema: unknown, experience: unknown): string[] {
    const key = JSON.stringify(contentSchema);
    let check = this.cache.get(key);
    if (!check) {
      check = this.ajv.compile(contentSchema as object);
      this.cache.set(key, check);
    }
    if (check(experience)) return [];
    return (check.errors ?? []).map((e) =>
      `${e.instancePath || "/"} ${e.message ?? "is invalid"}`.trim(),
    );
  }
}
