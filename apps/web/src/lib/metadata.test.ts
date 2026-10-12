import { expect, it } from "vitest";
import { pageMetadata } from "./metadata";

it("builds title, canonical, alternates and Open Graph for a locale", () => {
  const meta = pageMetadata({
    locale: "ar",
    segments: ["haifa"],
    title: "حيفا",
    description: "وصف",
  });
  expect(meta.title).toBe("حيفا · درب");
  expect(meta.alternates?.canonical).toBe("/ar/haifa");
  expect(meta.alternates?.languages).toEqual({
    he: "/haifa",
    ar: "/ar/haifa",
    en: "/en/haifa",
    "x-default": "/haifa",
  });
  expect(meta.openGraph).toMatchObject({ url: "/ar/haifa", locale: "ar_IL" });
  expect(JSON.stringify(meta.openGraph)).toContain("/brand/og-he.jpg");
});

it("uses the English share image for English and no suffix for the brand itself", () => {
  const meta = pageMetadata({ locale: "en", segments: [], title: "Darb", description: "d" });
  expect(meta.title).toBe("Darb");
  expect(JSON.stringify(meta.openGraph)).toContain("/brand/og-en.jpg");
});
