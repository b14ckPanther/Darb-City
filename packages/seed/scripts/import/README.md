# Open-data importers

Real public businesses for Darb, from official open data (data.gov.il) and OpenStreetMap. Each
importer writes one file, `packages/seed/data/listings/<source>.json`, with a `source` block (name,
url, resource id, licence, fetched date, counts, what was left out and why) and its `businesses`
in the `SeedBusiness` shape. `loadListings()` in `packages/seed/src/index.ts` reads every file in
that folder, so a new importer needs no loader change.

Rules every importer keeps: the north only (places whose parent chain leads to `northern-district`
or `haifa-district`); never Google; never an invented pin (a record without a confident point is
skipped and counted); hours only when a source gives them; no bars, pork, gambling or lottery; no
long dashes or maqaf in any text (`-` only).

## Run

From the repo root, Node 22+:

```sh
node packages/seed/scripts/import/fuel.mjs      # data/listings/fuel-north.json
node packages/seed/scripts/import/garages.mjs   # data/listings/garages-north.json
node packages/seed/scripts/import/banks.mjs     # data/listings/banks-north.json
node packages/seed/scripts/import/ev.mjs        # data/listings/ev-north.json
```

Raw responses are cached in `scripts/import/.cache/` (gitignored); a re-run reads the cache. Add
`--refresh` to fetch again. Run `fuel.mjs` before `ev.mjs` (chargers at a fuel station go on the
station's card). Every importer skips what the other listing files already have, so the order of
the others does not matter. After an importer adds brands to `data/brands.json`, the showroom
build (`npx tsx scripts/build-showroom.ts`) keeps them.

Then check: `pnpm --filter @darb/seed test` (validates every business) and seed a database.

| Importer      | Source                                                                                       | Points                                                       |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `fuel.mjs`    | Energy Ministry fuel stations (`5537a0ef…`), phones (`ff3b653c…`), EV chargers (`528482f2…`) | official coordinates; services from OSM within 150 m         |
| `garages.mjs` | Ministry of Transport, garages and testing stations (`bb68386a…`)                            | none in the register: only where OSM has it by name or phone |
| `banks.mjs`   | Bank of Israel, physical branches (`2202bada…`)                                              | official coordinates                                         |
| `ev.mjs`      | Ministry of Transport, EV charging (`528482f2…`); OSM charging stations                      | OSM only (the ministry's SHP/KMZ are refused, 403)           |

Paz (`data/listings/paz-north.json`) was made by hand before this toolkit and is kept as it is;
`fuel.mjs` skips company `פז`.

## Toolkit

- `fetch.mjs`: data.gov.il datastore and Overpass (bbox `32.3,34.85,33.35,35.9`), with retries,
  the `Darb/1.0 (founder@darb.co.il)` user agent and the cache.
- `places.mjs`: district membership and `match({ town, names, lat, lng })`: a town-name match
  (normalising ק/כ, doubled yod and vav, maqaf and hyphens, קרית/קריית, parentheses, "kibbutz"),
  checked against the point, else a place named inside the text, else the nearest settlement
  within 6 km. A point more than 15 km from every place its town names is a `conflict`: skipped.
- `names.mjs`: Hebrew to Arabic and English, offline: a place's own names, a word list
  (`WORDS`, plus `extraWords` per importer) and letter maps for the rest.
- `phones.mjs`: `+972 X-XXX-XXXX` / `+972 5X-XXX-XXXX`, invalid numbers dropped.
- `dedupe.mjs`: one business within 120 m under one brand and a similar name, or under one
  official id; the richer record is kept.
- `emit.mjs`: the `SeedBusiness` record, slugs (prefix + latin name, unique per place, given
  after duplicates go), brands and the listing file.
- `osm.mjs`, `ev-match.mjs`: station services from OSM; chargers named for a chain's station.

Tests (`*.test.mjs`, fixtures in `fixtures/`) run with the seed package's tests.

## Attribution

OpenStreetMap data © OpenStreetMap contributors, ODbL (openstreetmap.org/copyright). Ministry of
Transport data is CC BY; Energy Ministry and Bank of Israel data are data.gov.il "Other (Open)".
Each listing file's `source` block says which it uses.
