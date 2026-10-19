// @vitest-environment node
import { expect, it } from "vitest";
import { GET, POST } from "./route";

const ctx = (locale: string) => ({ params: Promise.resolve({ locale }) });

it("opens the capture with the shared text and link (the worker keeps photos)", async () => {
  const form = new FormData();
  form.set("title", "Abu Samir Salon");
  form.set("text", "https://maps.app.goo.gl/abc");
  form.set("photo", new File(["jpeg"], "sign.jpg", { type: "image/jpeg" }));
  const res = await POST(
    new Request("http://localhost:3000/en/helpers/share", { method: "POST", body: form }),
    ctx("en"),
  );
  expect(res.status).toBe(303);
  const to = new URL(res.headers.get("location")!);
  expect(to.pathname).toBe("/en/helpers");
  expect(to.searchParams.get("title")).toBe("Abu Samir Salon");
  expect(to.searchParams.get("text")).toBe("https://maps.app.goo.gl/abc");
  expect(to.searchParams.has("shared")).toBe(false);
});

it("never fails: an unreadable share and a plain visit open the capture", async () => {
  const res = await POST(
    new Request("http://localhost:3000/helpers/share", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x" },
      body: "garbage",
    }),
    ctx("he"),
  );
  expect(res.status).toBe(303);
  expect(new URL(res.headers.get("location")!).pathname).toBe("/helpers");
  const get = await GET(new Request("http://localhost:3000/ar/helpers/share"), ctx("ar"));
  expect(new URL(get.headers.get("location")!).pathname).toBe("/ar/helpers");
});
