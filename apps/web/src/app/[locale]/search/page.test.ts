// @vitest-environment node
import { expect, it } from "vitest";

it("renders every search on request: never prerendered, never cached", async () => {
  const page = await import("./page");
  expect(page.dynamic).toBe("force-dynamic");
  expect("generateStaticParams" in page).toBe(false);
  expect("revalidate" in page).toBe(false);
});
