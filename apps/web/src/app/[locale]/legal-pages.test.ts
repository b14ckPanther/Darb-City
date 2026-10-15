import { LOCALES } from "@darb/core";
import { expect, it } from "vitest";
import * as accessibility from "./accessibility/page";
import * as privacy from "./privacy/page";
import * as terms from "./terms/page";

const pages = { accessibility, terms, privacy };

it("prerenders every legal page in every locale", () => {
  for (const page of Object.values(pages)) {
    expect(page.generateStaticParams()).toEqual(LOCALES.map((locale) => ({ locale })));
  }
});

it("gives each page its own canonical URL and alternates", async () => {
  for (const [name, page] of Object.entries(pages)) {
    const meta = await page.generateMetadata({ params: Promise.resolve({ locale: "ar" }) });
    expect(meta.alternates?.canonical).toBe(`/ar/${name}`);
    expect(meta.alternates?.languages).toMatchObject({ he: `/${name}`, en: `/en/${name}` });
  }
});
