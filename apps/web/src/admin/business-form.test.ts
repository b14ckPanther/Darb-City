import { expect, it } from "vitest";
import { businessFromForm, comparable, EMPTY_EXPERIENCE } from "./business-form";

const form = (over: Record<string, string> = {}) => {
  const f = new FormData();
  const base: Record<string, string> = {
    "name.ar": "كراميل",
    "tagline.ar": "مطعم",
    "address.ar": "شارع ١",
    primaryKindId: "0190a000-0000-7000-8000-000000000002",
    kinds: "cafes\ndesserts",
    lat: "32.92",
    lng: "35.08",
    phone: "+972 4-000-0000",
    whatsapp: "",
    website: "https://caramel.darb.co.il",
    "hours.weekly": JSON.stringify({ "0": [{ open: "12:00", close: "23:00" }] }),
    "hours.exceptions": "2026-12-31 12:00-18:00",
    "attributes.base": JSON.stringify({ parking: true }),
    delivers: "on",
    experience: JSON.stringify(EMPTY_EXPERIENCE),
    tier: "darb",
    "apps.web": "https://caramel.darb.co.il",
    "apps.ios": "",
    "apps.android": "",
  };
  for (const [k, v] of Object.entries({ ...base, ...over })) f.append(k, v);
  return f;
};

it("reads a full business, merging the delivers checkbox into the attributes", () => {
  const { data, kindSlugs, errors } = businessFromForm(form());
  expect(errors).toEqual([]);
  expect(kindSlugs).toEqual(["cafes", "desserts"]);
  expect(data).toMatchObject({
    whatsapp: null,
    attributes: { parking: true, delivers: true },
    apps: { web: "https://caramel.darb.co.il" },
    hours: {
      weekly: { "0": [{ open: "12:00", close: "23:00" }] },
      exceptions: [{ date: "2026-12-31", intervals: [{ open: "12:00", close: "18:00" }] }],
    },
  });
});

it("reports bad JSON and unreadable special days instead of throwing", () => {
  const { errors } = businessFromForm(form({ experience: "{nope", "hours.exceptions": "someday" }));
  expect(errors).toEqual(["experience: not valid JSON", "hours: cannot read “someday”"]);
});

it("an unchecked delivers box removes the attribute", () => {
  const f = form();
  f.delete("delivers");
  expect(businessFromForm(f).data.attributes).toEqual({ parking: true, delivers: false });
});

it("leaves closed days out of the weekly hours, as the seed writes them", () => {
  const f = form({
    "hours.weekly": JSON.stringify({ "0": [{ open: "12:00", close: "23:00" }], "1": [], "6": [] }),
  });
  expect(businessFromForm(f).data.hours?.weekly).toEqual({
    "0": [{ open: "12:00", close: "23:00" }],
  });
});

it("compares a saved business the way the form reads it", () => {
  const saved = {
    primaryKindId: "p",
    kindIds: ["p", "b", "a"],
    attributes: { parking: true },
    hours: { weekly: { "0": [{ open: "12:00", close: "23:00" }], "3": [] }, exceptions: [] },
  };
  expect(comparable(saved)).toEqual({
    primaryKindId: "p",
    kindIds: ["a", "b"],
    attributes: { parking: true, delivers: false },
    hours: { weekly: { "0": [{ open: "12:00", close: "23:00" }] }, exceptions: [] },
  });
});
