// Every physical bank branch in the north, from the Bank of Israel's list ("סניפי בנקים פיזיים").
// The list has each branch's coordinates, phone, closed day and accessibility; no hours.
// Run: node packages/seed/scripts/import/banks.mjs [--refresh]
import { pathToFileURL } from "node:url";
import { dedupe } from "./dedupe.mjs";
import { business, createSlugger, ensureBrands, readListings, writeListing } from "./emit.mjs";
import { datastore, today } from "./fetch.mjs";
import { createNamer, plainDashes } from "./names.mjs";
import { normalizePhone } from "./phones.mjs";
import { createPlaceMatcher } from "./places.mjs";

export const FILE = "banks-north.json";
export const RESOURCE = "2202bada-4baf-45f5-aa61-8c5bad9646d3";

/** Banks by Bank of Israel code. Codes left out are not branches the public walks into. */
export const BANKS = {
  4: {
    slug: "yahav",
    name: { he: "בנק יהב", ar: "بنك يهاف", en: "Bank Yahav" },
    accent: "#5fb3a8",
  },
  10: {
    slug: "leumi",
    name: { he: "בנק לאומי", ar: "بنك لئومي", en: "Bank Leumi" },
    accent: "#6fa8dc",
  },
  11: {
    slug: "discount",
    name: { he: "בנק דיסקונט", ar: "بنك ديسكونت", en: "Discount Bank" },
    accent: "#9fb86a",
  },
  12: {
    slug: "hapoalim",
    name: { he: "בנק הפועלים", ar: "بنك هبوعليم", en: "Bank Hapoalim" },
    accent: "#e08a6d",
  },
  14: {
    slug: "otsar-hahayal",
    name: { he: "בנק אוצר החייל", ar: "بنك أوتسار هحيال", en: "Bank Otsar Ha-Hayal" },
    accent: "#a99bd6",
  },
  17: {
    slug: "mercantile",
    name: { he: "בנק מרכנתיל", ar: "بنك مركنتيل", en: "Mercantile Bank" },
    accent: "#9fb86a",
  },
  18: {
    slug: "one-zero",
    name: { he: "וואן זירו", ar: "وان زيرو", en: "One Zero" },
    accent: "#a99bd6",
  },
  20: {
    slug: "mizrahi-tefahot",
    name: { he: "בנק מזרחי טפחות", ar: "بنك مزراحي طفحوت", en: "Mizrahi Tefahot Bank" },
    accent: "#d6a473",
  },
  22: {
    slug: "citibank",
    name: { he: "סיטיבנק", ar: "سيتي بنك", en: "Citibank" },
    accent: "#6fa8dc",
  },
  23: { slug: "hsbc", name: { he: "HSBC", ar: "HSBC", en: "HSBC" }, accent: "#e08a6d" },
  26: { slug: "u-bank", name: { he: "יו-בנק", ar: "يو بنك", en: "U-Bank" }, accent: "#d9aaa2" },
  31: {
    slug: "first-international",
    name: { he: "הבנק הבינלאומי", ar: "البنك الدولي", en: "First International Bank" },
    accent: "#a99bd6",
  },
  39: { slug: "sbi", name: { he: "SBI", ar: "SBI", en: "State Bank of India" }, accent: "#6fa8dc" },
  46: {
    slug: "massad",
    name: { he: "בנק מסד", ar: "بنك مساد", en: "Bank Massad" },
    accent: "#5fb3a8",
  },
  52: {
    slug: "pagi",
    name: { he: 'בנק פאג"י', ar: "بنك باجي", en: "Bank PAGI" },
    accent: "#d9a54c",
  },
  54: {
    slug: "jerusalem",
    name: { he: "בנק ירושלים", ar: "بنك القدس", en: "Bank of Jerusalem" },
    accent: "#d9aaa2",
  },
};
/** 50 clearing centre, 59 cash machines and 99 the Bank of Israel are not branches. */
const NOT_BRANCHES = new Set([50, 59, 99]);

const DAY = {
  "יום א": { he: "ראשון", ar: "الأحد", en: "Sunday" },
  "יום ב": { he: "שני", ar: "الاثنين", en: "Monday" },
  "יום ג": { he: "שלישי", ar: "الثلاثاء", en: "Tuesday" },
  "יום ד": { he: "רביעי", ar: "الأربعاء", en: "Wednesday" },
  "יום ה": { he: "חמישי", ar: "الخميس", en: "Thursday" },
  "יום ו": { he: "שישי", ar: "الجمعة", en: "Friday" },
  "יום ש": { he: "שבת", ar: "السبت", en: "Saturday" },
};
const L = {
  number: { he: "מספר סניף", ar: "رقم الفرع", en: "Branch number" },
  closed: { he: "יום סגור", ar: "يوم العطلة", en: "Closed on" },
  access: { he: "נגישות", ar: "إمكانية الوصول", en: "Accessibility" },
  accessYes: { he: "נגיש לכיסא גלגלים", ar: "مناسب للكراسي المتحركة", en: "Wheelchair accessible" },
  type: { he: "סוג סניף", ar: "نوع الفرع", en: "Branch type" },
  special: {
    he: "עסקים ובנקאות פרטית",
    ar: "مصالح وخدمات خاصة",
    en: "Business and private banking",
  },
  regular: { he: "סניף רגיל", ar: "فرع عادي", en: "Everyday banking" },
  cta: { he: "ניווט לסניף", ar: "خذني للفرع", en: "Navigate to the branch" },
};

/** Pure, for fixtures: the branch rows to listings. */
export function buildBanks({ rows, existing = [] }) {
  const matcher = createPlaceMatcher();
  const namer = createNamer(undefined, {
    extraWords: {
      עסקים: { ar: "مصالح", en: "Business", after: true },
      "בנקאות פרטית": { ar: "خدمات خاصة", en: "Private Banking", after: true },
      "מרכז עסקים": { ar: "مركز مصالح", en: "Business Centre", after: true },
      שלוחת: { ar: "فرع", en: "Branch", after: true },
      "מרכז שירות": { ar: "مركز خدمة", en: "Service Centre", after: true },
      "מרכז קופות": { ar: "مركز صناديق", en: "Cash Centre", after: true },
    },
  });
  const counts = {
    fetched: rows.length,
    notBranch: 0,
    digital: 0,
    closed: 0,
    noPoint: 0,
    outsideNorth: 0,
    matchedByName: 0,
    matchedNearest: 0,
    withPhone: 0,
  };
  const slugFor = createSlugger(existing.map((b) => `${b.place}/${b.slug}`));
  const businesses = [];
  const conflicts = [];
  for (const r of rows) {
    const code = Number(r.Bank_Code);
    const bank = BANKS[code];
    if (!bank || NOT_BRANCHES.has(code)) {
      counts.notBranch++;
      continue;
    }
    if (r.Branch_Type === "סניף דיגיטלי") {
      counts.digital++;
      continue;
    }
    if (String(r.Close_Date ?? "").trim() || r.Merge_Bank) {
      counts.closed++;
      continue;
    }
    // The list calls latitude X and longitude Y.
    const lat = Number(r.X_Coordinate);
    const lng = Number(r.Y_Coordinate);
    if (!(lat > 29 && lat < 34 && lng > 34 && lng < 36)) {
      counts.noPoint++;
      continue;
    }
    const m = matcher.match({ town: r.City, names: [r.Branch_Name], lat, lng });
    if (m?.how === "conflict") {
      if (matcher.inNorth(m.town.slug)) {
        counts.pointFarFromTown = (counts.pointFarFromTown ?? 0) + 1;
        conflicts.push(`${code}-${r.Branch_Code} ${r.Branch_Name} (${r.City}): ${m.km} km away`);
      } else counts.outsideNorth++;
      continue;
    }
    if (!m || !matcher.inNorth(m.place.slug)) {
      counts.outsideNorth++;
      continue;
    }
    counts[m.how === "name" ? "matchedByName" : "matchedNearest"]++;
    const phone = normalizePhone(r.Telephone);
    if (phone) counts.withPhone++;
    const branch = namer.name(plainDashes(r.Branch_Name || m.place.name.he).trim(), m.place);
    const name = {
      he: `${bank.name.he} ${branch.he}`,
      ar: `${bank.name.ar} ${branch.ar}`,
      en: `${bank.name.en} ${branch.en}`,
    };
    const special = r.Branch_Type === "מיוחד";
    const day = DAY[String(r.day_closed ?? "").trim()];
    const items = [
      {
        label: L.number,
        meta: { he: `${r.Branch_Code}`, ar: `${r.Branch_Code}`, en: `${r.Branch_Code}` },
      },
      { label: L.type, meta: special ? L.special : L.regular },
      ...(day ? [{ label: L.closed, meta: day }] : []),
      ...(r.Handicap_Access === "כן" ? [{ label: L.access, meta: L.accessYes }] : []),
    ];
    const tagline = {
      he: `סניף ${bank.name.he}`,
      ar: `فرع ${bank.name.ar}`,
      en: `${bank.name.en} branch`,
    };
    businesses.push(
      business({
        slug: slugFor(m.place.slug, bank.slug, branch.en),
        place: m.place.slug,
        brand: bank.slug,
        kinds: ["banks"],
        name,
        tagline,
        address: {
          he: plainDashes(r.Branch_Address || m.place.name.he).trim(),
          ar: m.place.name.ar,
          en: m.place.name.en,
        },
        lat,
        lng,
        attributes: {
          bankCode: code,
          branchCode: Number(r.Branch_Code),
          bankBranch: `${code}-${r.Branch_Code}`,
        },
        phone,
        screen: { title: tagline, items, cta: L.cta },
        accent: bank.accent,
      }),
    );
  }
  const { kept, dropped } = dedupe(businesses, { existing, idKeys: ["bankBranch"] });
  counts.inNorth = businesses.length;
  counts.deduped = dropped.length;
  counts.emitted = kept.length;
  return { businesses: kept, counts, conflicts };
}

async function main() {
  const rows = await datastore(RESOURCE);
  const existing = readListings({ except: FILE });
  const { businesses, counts, conflicts } = buildBanks({ rows, existing });
  ensureBrands(Object.values(BANKS).filter((b) => businesses.some((x) => x.brand === b.slug)));
  writeListing(
    FILE,
    {
      name: "בנק ישראל, סניפי בנקים פיזיים (data.gov.il)",
      url: "https://data.gov.il/dataset/branches",
      resource: RESOURCE,
      licence: "data.gov.il, Other (Open), Bank of Israel",
      region: "northern-district, haifa-district",
      fetched: today(),
      left_out:
        "digital branches, closed or merged branches, the clearing centre, cash machines and the Bank of Israel",
      hours: "none: the list gives only the day each branch is closed",
      counts,
      point_far_from_town: conflicts,
    },
    businesses,
  );
  console.log(JSON.stringify(counts));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
