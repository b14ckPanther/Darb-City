import "server-only";
import {
  AdminBusinessPatchSchema,
  LocateQuerySchema,
  type AdminBusinessDto,
  type AdminKindDto,
  type AdminSectorDto,
} from "@darb/contracts";
import { pickText } from "@darb/core";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/lib/locale";
import { adminApi } from "./api";
import { adminToken } from "./auth";
import { sameOrigin } from "./field-proxy";
import { quickPatch, type QuickInput } from "./quick-form";

const NO_STORE = { "cache-control": "no-store" };
const answer = (status: number, body: object) => Response.json(body, { status, headers: NO_STORE });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const QUICK_ACTIONS = ["business", "save", "status", "locate"] as const;

/**
 * The quick editor on the public card: /admin/quick-api/{business,save,status,locate}. It runs
 * under the admin proxy (Clerk, the admin's CSP) and forwards with the admin's own token, so the
 * API's guard decides; the public page's marker cookie grants nothing.
 */
export async function quickApi(action: string, request: Request): Promise<Response> {
  if (!(QUICK_ACTIONS as readonly string[]).includes(action)) return answer(404, {});
  const method = request.method;
  if ((action === "business") !== (method === "GET")) return answer(405, {});
  if (method === "POST" && !sameOrigin(request)) return answer(403, { reason: "origin" });
  if (!(await adminToken())) return answer(401, { reason: "signed-out" });
  const api = await adminApi();
  try {
    if (action === "business") {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") ?? "";
      const raw = url.searchParams.get("locale") ?? "he";
      const locale = isLocale(raw) ? raw : "he";
      if (!UUID.test(id)) return answer(400, {});
      const [b, kinds, sectors] = await Promise.all([
        api.businesses.get({ params: { id } }),
        api.kinds.list({ query: {} }),
        api.sectors.list(),
      ]);
      if (b.status !== 200) return answer(b.status === 404 ? 404 : b.status, {});
      if (kinds.status !== 200 || sectors.status !== 200) return answer(502, {});
      const sectorName = new Map(
        (sectors.body as AdminSectorDto[]).map((s) => [s.id, pickText(s.name, locale)]),
      );
      return answer(200, {
        business: b.body,
        kinds: (kinds.body as AdminKindDto[])
          .map((k) => ({
            id: k.id,
            name: pickText(k.name, locale),
            group: sectorName.get(k.sectorId) ?? "",
          }))
          .sort(
            (x, y) =>
              x.group.localeCompare(y.group, locale) || x.name.localeCompare(y.name, locale),
          ),
      });
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const id = typeof body?.id === "string" ? body.id : "";
    if (action === "locate") {
      const parsed = LocateQuerySchema.safeParse(body);
      if (!parsed.success) return answer(400, { found: null, reason: "error" });
      const res = await api.locate({ body: parsed.data });
      return res.status === 200
        ? answer(200, res.body)
        : answer(200, { found: null, reason: res.status === 401 ? "signed-out" : "error" });
    }
    if (!UUID.test(id)) return answer(400, {});
    if (action === "status") {
      const status = body?.status;
      if (status !== "published" && status !== "draft") return answer(400, {});
      const res = await api.businesses.status({ params: { id }, body: { status } });
      revalidatePath("/admin/[locale]", "layout");
      return answer(
        res.status === 200 ? 200 : res.status,
        res.status === 200 ? { ok: true } : (res.body as object),
      );
    }
    // save
    const current = await api.businesses.get({ params: { id } });
    if (current.status !== 200) return answer(current.status, {});
    const patch = quickPatch(body?.input as QuickInput, current.body as AdminBusinessDto);
    if (Object.keys(patch).length === 0) return answer(200, { ok: true, changed: false });
    const parsed = AdminBusinessPatchSchema.safeParse(patch);
    if (!parsed.success)
      return answer(400, {
        errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    const res = await api.businesses.update({ params: { id }, body: parsed.data });
    if (res.status !== 200) return answer(res.status, res.body as object);
    // The public page shows the change at its next load: drop its cached copy now and wait.
    const fresh = await api.misc.revalidate({ params: { entity: "business", id }, body: {} });
    revalidatePath("/admin/[locale]", "layout");
    return answer(200, {
      ok: true,
      changed: true,
      revalidated: fresh.status === 200 ? fresh.body.revalidated : false,
    });
  } catch {
    return answer(503, { reason: "unavailable" });
  }
}
