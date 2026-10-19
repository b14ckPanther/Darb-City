import type { AdminKey } from "./copy";

/** Words for the codes the API speaks, so a slug or enum is never what the admin reads. */
export const PLACE_TYPE_KEY = {
  country: "typeCountry",
  region: "typeRegion",
  city: "typeCity",
  town: "typeTown",
  village: "typeVillage",
  neighbourhood: "typeNeighbourhood",
} as const satisfies Record<string, AdminKey>;

export const TIER_KEY = {
  basic: "tierBasic",
  verified: "tierVerified",
  darb: "tierDarb",
  example: "tierExample",
} as const satisfies Record<string, AdminKey>;

export const TEMPLATE_KEY = {
  menu: "tplMenu",
  booking: "tplBooking",
  shop: "tplShop",
  portfolio: "tplPortfolio",
  listing: "tplListing",
  schedule: "tplSchedule",
  quote: "tplQuote",
  donate: "tplDonate",
  tracker: "tplTracker",
  pass: "tplPass",
  builder: "tplBuilder",
  station: "tplStation",
} as const satisfies Record<string, AdminKey>;

export const SOURCE_KEY = {
  imported: "sourceImported",
  edited: "sourceEdited",
  street: "sourceStreet",
  join: "sourceJoin",
} as const satisfies Record<string, AdminKey>;

/** Where a business row came from, as stored (seed import, the owner, a claim, the admin). */
export const ORIGIN_KEY = {
  seed: "originSeed",
  self: "originSelf",
  claimed: "originClaimed",
  admin: "originAdmin",
} as const satisfies Record<string, AdminKey>;

export const ISSUE_KEY = {
  "no-phone": "attnNoPhone",
  "no-hours": "attnNoHours",
  "pin-at-centre": "attnPinCentre",
  "pin-outside": "attnPinOutside",
} as const satisfies Record<string, AdminKey>;
