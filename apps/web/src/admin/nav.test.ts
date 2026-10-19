import { expect, it } from "vitest";
import { activeItem, NAV, NAV_ITEMS } from "./nav";
import { adminCopy } from "./copy";

it("marks the section a deep page belongs to, and the overview only at the root", () => {
  expect(activeItem("")?.label).toBe("navHome");
  expect(activeItem("/")?.label).toBe("navHome");
  expect(activeItem("/businesses")?.label).toBe("navBusinesses");
  expect(activeItem("/businesses/0190a000-0000-7000-8000-00000000abcd")?.label).toBe(
    "navBusinesses",
  );
  expect(activeItem("/plans/texts?x=1")?.label).toBe("navPlans");
  expect(activeItem("/kindsx")).toBeUndefined();
});

it("keeps every existing admin screen in the menu, in four groups, with five phone tabs", () => {
  expect(NAV.map((g) => g.label)).toEqual([
    "groupToday",
    "groupContent",
    "groupGrowth",
    "groupSettings",
  ]);
  expect(NAV_ITEMS.map((i) => i.href).sort()).toEqual(
    [
      "",
      "/businesses",
      "/places",
      "/sectors",
      "/kinds",
      "/join-requests",
      "/field",
      "/helpers",
      "/inquiries",
      "/report",
      "/plans",
    ].sort(),
  );
  // Four tabs plus More fill the bar.
  expect(NAV_ITEMS.filter((i) => i.tab)).toHaveLength(4);
  for (const i of NAV_ITEMS) expect(adminCopy.he[i.label]).toBeTruthy();
});
