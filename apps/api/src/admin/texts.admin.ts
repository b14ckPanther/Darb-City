import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import { contract, type AdminTextDto, type AdminTextPatchDto } from "@darb/contracts";
import type { Localized } from "@darb/core";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import type { SiteText } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminWriter } from "./admin-writer.js";
import { json } from "./json.js";
import { LIST_CAP } from "./list-cap.js";
import { notFound } from "./outcome.js";
import { seedSource } from "./seed-source.js";
import { webTags } from "./tags.js";

export const toAdminText = (t: SiteText): AdminTextDto => ({
  id: t.id,
  key: t.key,
  value: t.value as Localized,
  editedAt: t.editedAt?.toISOString() ?? null,
  seedSource: seedSource.text(t.key),
});

/** Blank languages are dropped, so an emptied field falls back like a missing one. */
const trimmed = (value: Localized): Localized =>
  Object.fromEntries(
    Object.entries(value).flatMap(([l, v]) => (v && v.trim() !== "" ? [[l, v.trim()]] : [])),
  );

/**
 * Page copy (Task: pricing). The keys come from the seed: the page has a slot for each, so the
 * admin edits words, never adds or removes slots.
 */
@Injectable()
export class TextsAdmin {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
  ) {}

  async list() {
    const rows = await this.prisma.siteText.findMany({ orderBy: { key: "asc" }, take: LIST_CAP });
    return rows.map(toAdminText);
  }

  async update(actor: AdminActor, id: string, patch: AdminTextPatchDto) {
    if (!(await this.prisma.siteText.findUnique({ where: { id } }))) return notFound("text");
    const row = await this.writer.write(actor, "update", "text", async (tx) => {
      const t = await tx.siteText.update({
        where: { id },
        data: { value: json(trimmed(patch.value)), editedAt: new Date() },
      });
      return { row: t, entityId: id, fields: ["value"], tags: webTags.text() };
    });
    return { status: 200 as const, body: toAdminText(row) };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminTextsController {
  constructor(private readonly texts: TextsAdmin) {}

  @TsRestHandler(contract.admin.texts)
  handler(@Req() req: AdminRequest) {
    const actor = req.admin!;
    return tsRestHandler(contract.admin.texts, {
      list: async () => ({ status: 200, body: await this.texts.list() }),
      update: async ({ params, body }) => this.texts.update(actor, params.id, body),
    });
  }
}
