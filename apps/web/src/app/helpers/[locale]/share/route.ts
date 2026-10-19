import { isLocale } from "@/lib/locale";
import { helperHref } from "@/helpers/routes";

type Context = { params: Promise<{ locale: string }> };

/**
 * A share into the helper app without its service worker (the first share right after install, or
 * a browser without one): the shared text and link open the capture; a photo is left behind (the
 * worker keeps photos, so a large one never has to pass through the server).
 */
export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : "he";
  const back = new URL(helperHref(locale), request.url);
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data") || type.includes("x-www-form-urlencoded")) {
      const form = await request.formData();
      for (const key of ["title", "text", "url"]) {
        const value = form.get(key);
        if (typeof value === "string" && value.trim())
          back.searchParams.set(key, value.trim().slice(0, 2000));
      }
    }
  } catch {
    // Too large or unreadable: the capture still opens.
  }
  return Response.redirect(back, 303);
}

/** Opened by hand: the capture. */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { locale: raw } = await params;
  return Response.redirect(new URL(helperHref(isLocale(raw) ? raw : "he"), request.url), 303);
}
