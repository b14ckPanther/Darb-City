import { Inject, Injectable, Logger } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config.js";

/** Spec §6.2: after a write, the API asks the web to refresh the affected cached pages. */
@Injectable()
export class WebRevalidator {
  private readonly logger = new Logger(WebRevalidator.name);
  private warned = false;
  fetchImpl: typeof fetch = fetch;
  retryDelayMs = 1000;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** Off when REVALIDATE_URL is unset (development): pages then refresh on their own timer. */
  get enabled(): boolean {
    return Boolean(this.config.admin.revalidateUrl && this.config.admin.revalidateSecret);
  }

  async revalidate(tags: string[], options: { immediate?: boolean } = {}): Promise<boolean> {
    const { revalidateUrl: url, revalidateSecret: secret } = this.config.admin;
    if (!url || !secret) {
      if (!this.warned)
        this.logger.warn("REVALIDATE_URL is not set: web pages refresh on their own timer");
      this.warned = true;
      return false;
    }
    const body = JSON.stringify({
      tags: [...new Set(tags)],
      immediate: options.immediate === true,
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this.fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-revalidate-secret": secret },
          body,
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) return true;
        this.logger.warn(`Web revalidation answered ${res.status}`);
      } catch {
        this.logger.warn("Web revalidation failed");
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, this.retryDelayMs));
    }
    return false;
  }
}
