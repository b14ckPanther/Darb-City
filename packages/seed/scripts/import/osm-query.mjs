// What the all-kinds importer asks OpenStreetMap for: every named feature carrying a key a Darb
// kind can come from. Classification (kind-map.mjs) decides what is kept.
export const ALL_KINDS_QUERY = [
  'nwr["name"]["shop"]',
  'nwr["name"]["office"]',
  'nwr["name"]["craft"]',
  'nwr["name"]["healthcare"]',
  'nwr["name"]["tourism"]',
  'nwr["name"]["club"]',
  'nwr["name"]["amenity"]',
  'nwr["name"]["leisure"]',
  'nwr["name"]["emergency"]',
  'nwr["name"]["man_made"="works"]',
  'nwr["name"]["industrial"]',
  'nwr["name"]["sport"]["building"]',
]
  .map((s) => `${s};`)
  .join("\n");
