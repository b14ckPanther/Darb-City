import type { INestApplication } from "@nestjs/common";
import { vi, type Mock } from "vitest";
import { WebRevalidator } from "../src/admin/revalidator.js";
import type { PrismaService } from "../src/prisma/prisma.service.js";
import { SearchEvents } from "../src/search/index-queue.js";
import { createTestApp } from "./app.js";

/** ADMIN_EMAILS=admin@darb.test in vitest.config.ts makes this user an admin at first sight. */
export const ADMIN = "Bearer fake.user_admin.admin@darb.test";
export const STRANGER = "Bearer fake.user_other.other@darb.test";

/** The real app with search events and web revalidation recorded instead of sent. */
export interface AdminTestApp {
  app: INestApplication;
  prisma: PrismaService;
  notify: Mock;
  revalidate: Mock;
}

export async function createAdminTestApp(): Promise<AdminTestApp> {
  const notify = vi.fn();
  const revalidate = vi.fn(async (_tags: string[], _options?: { immediate?: boolean }) => true);
  const created = await createTestApp((b) =>
    b
      .overrideProvider(SearchEvents)
      .useValue({ notify, changed: vi.fn(async () => []), onModuleDestroy: async () => undefined })
      .overrideProvider(WebRevalidator)
      .useValue({ revalidate }),
  );
  return { ...created, notify, revalidate };
}
