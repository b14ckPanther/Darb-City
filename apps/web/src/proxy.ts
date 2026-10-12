import { NextResponse, type NextRequest } from "next/server";
import { routeLocale } from "./lib/locale-path";

export function proxy(request: NextRequest) {
  const route = routeLocale(request.nextUrl.pathname);
  if (route.action === "next") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = route.pathname;
  return route.action === "redirect" ? NextResponse.redirect(url, 308) : NextResponse.rewrite(url);
}

export const config = {
  // Route handlers, Next internals, brand files and anything with a file extension skip the proxy.
  matcher: ["/((?!api/|_next/|brand/|.*\\..*).*)"],
};
