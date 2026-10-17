// What OpenStreetMap says around a point: the fuel station itself and the services beside it.
// Data © OpenStreetMap contributors, ODbL; every listing file that uses it says so.
import { pointOf } from "./fetch.mjs";
import { km } from "./places.mjs";

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors (ODbL), openstreetmap.org/copyright";
export const NEARBY_M = 150;

/** Elements within `metres` of a point, nearest first, each with its point and distance. */
export function near(elements, point, metres = NEARBY_M) {
  return elements
    .map((el) => ({ el, ...pointOf(el) }))
    .map((x) => ({ ...x, m: km(point, x) * 1000 }))
    .filter((x) => x.m <= metres)
    .sort((a, b) => a.m - b.m);
}

const yes = (v) => v === "yes" || v === "only";

/**
 * Services at a station from its own OSM element and what stands within 150 m of it:
 * { grades: ["95", "98", "diesel"], store, wash, air, ev, self, toilets, access, open247 }.
 */
export function stationServices(fuelEl, around) {
  const t = fuelEl?.tags ?? {};
  const grades = [];
  if (yes(t["fuel:octane_95"]) || yes(t["fuel:gasoline_95"])) grades.push("95");
  if (yes(t["fuel:octane_98"])) grades.push("98");
  if (yes(t["fuel:diesel"]) || yes(t["fuel:GTL_diesel"])) grades.push("diesel");
  const has = (pred) => around.some(({ el }) => pred(el.tags ?? {}));
  return {
    grades,
    store: t.shop === "convenience" || has((x) => x.shop === "convenience"),
    wash: yes(t.car_wash) || has((x) => x.amenity === "car_wash"),
    air: yes(t.compressed_air) || has((x) => x.amenity === "compressed_air"),
    ev: yes(t["fuel:electricity"]) || has((x) => x.amenity === "charging_station"),
    self: yes(t.self_service),
    toilets: yes(t.toilets) || has((x) => x.amenity === "toilets"),
    access: t.wheelchair === "yes",
    open247: t.opening_hours?.trim() === "24/7",
  };
}
