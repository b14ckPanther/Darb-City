/* global self, caches, Response, URL */
// The helper app's service worker (registered on /helpers, /ar/helpers and /en/helpers only).
// It does one thing: a share into the app (manifest share_target, POST multipart) keeps the shared
// photo in a cache for the page to take once, then opens the capture with the rest in the address.
// Nothing else passes through it and nothing is cached for offline use.
const CACHE = "darb-helper-share";
const PHOTO = "/__darb-share/photo";
const SHARE = /^\/(?:(?:ar|en)\/)?helpers\/share\/?$/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.origin !== self.location.origin) return;
  if (!SHARE.test(url.pathname)) return;
  event.respondWith(
    (async () => {
      const back = new URL(url.pathname.replace(/\/share\/?$/, ""), url.origin);
      try {
        const form = await event.request.formData();
        const photo = form
          .getAll("photo")
          .find((f) => typeof f === "object" && f && String(f.type).startsWith("image/"));
        if (photo) {
          const cache = await caches.open(CACHE);
          await cache.put(PHOTO, new Response(photo, { headers: { "content-type": photo.type } }));
          back.searchParams.set("shared", "photo");
        }
        for (const key of ["title", "text", "url"]) {
          const value = form.get(key);
          if (typeof value === "string" && value.trim())
            back.searchParams.set(key, value.trim().slice(0, 2000));
        }
      } catch {
        // An unreadable share still opens the capture.
      }
      return Response.redirect(back.href, 303);
    })(),
  );
});
