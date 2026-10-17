import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classify,
  excluded,
  KIND_INFO,
  OWNED_ELSEWHERE,
  sourcesByKind,
  words,
} from "./kind-map.mjs";

const kinds = JSON.parse(readFileSync(new URL("../../data/kinds.json", import.meta.url), "utf8"));
const kindOf = (tags) => classify(tags)?.kinds?.[0] ?? null;

describe("kind map", () => {
  it("has a card name for every active kind outside food and other importers", () => {
    const want = kinds
      .filter((k) => k.status === "active" && k.sector !== "food")
      .filter((k) => !OWNED_ELSEWHERE.kinds.has(k.slug))
      .map((k) => k.slug);
    const missing = want.filter((slug) => !KIND_INFO[slug]);
    expect(missing).toEqual([]);
    for (const slug of Object.keys(KIND_INFO)) expect(want, slug).toContain(slug);
    for (const [slug, info] of Object.entries(KIND_INFO))
      for (const l of ["he", "ar", "en"]) expect(info.one[l], `${slug}.${l}`).toBeTruthy();
  });
  it("gives every kind a rule, or a note on why OpenStreetMap cannot find it", () => {
    const sources = sourcesByKind();
    for (const slug of Object.keys(KIND_INFO))
      expect(sources[slug] || KIND_INFO[slug].note, slug).toBeTruthy();
  });

  it.each([
    [{ shop: "hairdresser", name: "מספרת יוסי לגברים" }, "barbershops"],
    [{ shop: "hairdresser", hairdresser: "male", name: "Fade" }, "barbershops"],
    [{ shop: "hairdresser", name: "صالون حلاقة أبو علي" }, "barbershops"],
    [{ shop: "hairdresser", name: "סטודיו שיער ליאת" }, "salons"],
    [{ shop: "beauty", name: "Nail Art by Dana" }, "nails"],
    [{ shop: "beauty", beauty: "nails", name: "Dana" }, "nails"],
    [{ shop: "beauty", name: "קוסמטיקה רונית" }, "facials"],
    [{ shop: "beauty", name: "מרכז הלייזר" }, "aesthetic"],
    [{ shop: "massage", name: "Thai" }, "spas"],
    [{ shop: "cosmetics", name: "Sabon" }, "cosmetics"],
    [{ shop: "perfumery", name: "עטור" }, "perfume"],
    [{ amenity: "pharmacy", name: "סופר-פארם" }, "pharmacies"],
    [{ amenity: "dentist", name: "מרפאת שיניים" }, "dental"],
    [{ amenity: "dentist", name: "שיניים לילדים" }, "kids-dentists"],
    [{ amenity: "dentist", "healthcare:speciality": "orthodontics", name: "X" }, "orthodontics"],
    [{ healthcare: "physiotherapist", name: "פיזיו" }, "physio"],
    [{ healthcare: "speech_therapist", name: "X" }, "speech-therapy"],
    [{ amenity: "clinic", name: "כללית" }, "public-clinics"],
    [{ amenity: "doctors", name: "מרפאת ילדים" }, "pediatric"],
    [{ amenity: "hospital", name: "רמב״ם" }, "public-clinics"],
    [{ shop: "optician", name: "אופטיקנה" }, "optics"],
    [{ amenity: "veterinary", name: "וטרינר" }, "vets"],
    [{ leisure: "fitness_centre", name: "Holmes Place" }, "gyms"],
    [{ leisure: "fitness_centre", name: "סטודיו פילאטיס" }, "yoga"],
    [{ leisure: "sports_centre", sport: "karate", name: "דוג'ו" }, "martial-arts"],
    [{ leisure: "sports_centre", sport: "tennis", name: "מרכז הטניס" }, "padel"],
    [{ leisure: "swimming_pool", name: "בריכת העיר" }, "aquatic-centres"],
    [{ leisure: "sports_centre", name: "היכל הספורט" }, "sports-clubs"],
    [{ shop: "sports", name: "Decathlon" }, "sportswear"],
    [{ shop: "bicycle", name: "Bike" }, "bikes"],
    [{ amenity: "kindergarten", name: "גן רימון" }, "kindergartens"],
    [{ amenity: "childcare", name: "מעון ויצו" }, "daycare"],
    [{ shop: "toys", name: "Toys R Us" }, "toys"],
    [{ shop: "baby_goods", name: "שילב" }, "baby-shops"],
    [{ amenity: "driving_school", name: "X" }, "driving"],
    [{ amenity: "music_school", name: "קונסרבטוריון" }, "art-schools"],
    [{ amenity: "language_school", name: "Berlitz" }, "language-schools"],
    [{ amenity: "school", name: "المدرسة الإسلامية" }, "islamic-schools"],
    [{ amenity: "college", name: "מכללת אורט" }, "vocational"],
    [{ office: "it", name: "Tech Soft" }, "software-studios"],
    [{ amenity: "coworking_space", name: "Hub" }, "coworking"],
    [{ shop: "computer", name: "KSP" }, "it-support"],
    [{ shop: "mobile_phone", name: "סלולר פלוס" }, "electronics"],
    [{ shop: "mobile_phone", name: "מעבדת תיקון סלולר" }, "device-repair"],
    [{ office: "lawyer", name: "כהן ושות'" }, "lawyers"],
    [{ office: "company", name: 'עו"ד חאלד' }, "lawyers"],
    [{ office: "accountant", name: "X" }, "accountants"],
    [{ office: "insurance", name: "הראל" }, "insurance"],
    [{ office: "estate_agent", name: "RE/MAX" }, "real-estate"],
    [{ shop: "dry_cleaning", name: "ניקוי יבש" }, "tailoring"],
    [{ craft: "electrician", name: "X" }, "technicians"],
    [{ shop: "doityourself", name: "הום סנטר" }, "contractors"],
    [{ shop: "hardware", name: "כלי עבודה" }, "contractors"],
    [{ craft: "glaziery", name: "X" }, "glass-aluminium"],
    [{ shop: "locksmith", name: "X" }, "locksmiths"],
    [{ shop: "furniture", name: "ביתילי" }, "furniture"],
    [{ shop: "kitchen", name: "מטבחי זיו" }, "kitchens"],
    [{ shop: "curtain", name: "X" }, "curtains"],
    [{ shop: "paint", name: "טמבור" }, "painters"],
    [{ craft: "carpenter", name: "X" }, "carpentry"],
    [{ craft: "metal_construction", name: "X" }, "metalworks"],
    [{ man_made: "works", name: "מפעל תנובה" }, "factories"],
    [{ shop: "wholesale", name: "X" }, "wholesalers"],
    [{ office: "employment_agency", name: "X" }, "recruiting"],
    [{ shop: "car", name: "Toyota" }, "dealers"],
    [{ amenity: "car_rental", name: "Eldan" }, "car-rental"],
    [{ amenity: "car_wash", name: "X" }, "car-wash"],
    [{ shop: "car_parts", name: "X" }, "auto-parts"],
    [{ amenity: "taxi", name: "מוניות הדר" }, "taxis"],
    [{ shop: "motorcycle", name: "X" }, "motorcycles"],
    [{ shop: "garden_centre", name: "משתלת הגליל" }, "plant-shops"],
    [{ shop: "greengrocer", name: "פירות וירקות" }, "farm-shops"],
    [{ craft: "beekeeper", name: "X" }, "beekeepers"],
    [{ shop: "agrarian", name: "השקיה הגליל" }, "irrigation"],
    [{ shop: "agrarian", name: "X" }, "tractors"],
    [{ leisure: "horse_riding", name: "חוות הסוסים" }, "stables"],
    [{ amenity: "events_venue", name: "X" }, "venues"],
    [{ shop: "yes", name: "אולמי הנסיכה" }, "venues"],
    [{ shop: "florist", name: "X" }, "florists"],
    [{ craft: "photographer", name: "X" }, "photographers"],
    [{ shop: "copyshop", name: "X" }, "printing"],
    [{ leisure: "escape_game", name: "X" }, "escape-rooms"],
    [{ shop: "party", name: "X" }, "event-decor"],
    [{ tourism: "hotel", name: "מלון" }, "hotels"],
    [{ tourism: "guest_house", name: "צימרים בגליל" }, "hotels"],
    [{ tourism: "camp_site", name: "X" }, "camping"],
    [{ tourism: "museum", name: "X" }, "tours"],
    [{ shop: "travel_agency", name: "X" }, "travel-agencies"],
    [{ office: "travel_agent", name: "عمرة وحج النور" }, "umrah"],
    [{ amenity: "bureau_de_change", name: "X" }, "currency-exchange"],
    [{ shop: "supermarket", name: "שופרסל" }, "shops"],
    [{ shop: "musical_instrument", name: "X" }, "shops"],
    [{ shop: "clothes", name: "Castro" }, "fashion"],
    [{ shop: "clothes", name: "عبايات ليلى" }, "modest-fashion"],
    [{ shop: "clothes", clothes: "children", name: "X" }, "kids-clothing"],
    [{ shop: "clothes", name: "שמלות כלה" }, "bridal-rental"],
    [{ shop: "jewelry", name: "X" }, "gold"],
    [{ shop: "books", name: "צומת ספרים" }, "bookshops"],
    [{ shop: "pet", name: "X" }, "pet-shops"],
    [{ shop: "electronics", name: "X" }, "electronics"],
    [{ shop: "houseware", name: "X" }, "kitchenware"],
    [{ shop: "second_hand", name: "X" }, "charity-shops"],
    [{ amenity: "place_of_worship", religion: "muslim", name: "مسجد عمر" }, "mosques"],
    [{ amenity: "place_of_worship", religion: "christian", name: "X" }, "churches"],
    [{ amenity: "place_of_worship", religion: "jewish", name: "X" }, "synagogues"],
    [{ amenity: "place_of_worship", religion: "druze", name: "X" }, "druze-prayer-houses"],
    [{ amenity: "place_of_worship", name: "خلوة البياضة" }, "druze-prayer-houses"],
    [{ amenity: "place_of_worship", name: "בית כנסת אוהל משה" }, "synagogues"],
    [{ amenity: "grave_yard", name: "X" }, "janazah"],
    [{ shop: "religion", name: "X" }, "islamic-books"],
    [{ amenity: "townhall", name: "עיריית כרמיאל" }, "municipal"],
    [{ office: "insurance", name: "המוסד לביטוח לאומי" }, "municipal"],
    [{ amenity: "post_office", name: "דואר ישראל" }, "post-offices"],
    [{ amenity: "library", name: "X" }, "libraries"],
    [{ amenity: "police", name: "X" }, "emergency"],
    [{ amenity: "bus_station", name: "X" }, "buses"],
    [{ amenity: "parking", name: "חניון הקניון" }, "parking"],
    [{ amenity: "community_centre", name: 'מתנ"ס' }, "community-centres"],
    [{ amenity: "community_centre", name: "מועדון נוער" }, "youth-clubs"],
    [{ amenity: "nursing_home", name: "X" }, "senior-centres"],
    [{ club: "scout", name: "X" }, "scouts"],
    [{ office: "ngo", name: "X" }, "nonprofits"],
    [{ office: "ngo", name: 'גמ"ח כלים' }, "qard-hasan"],
  ])("%j is %s", (tags, kind) => expect(kindOf(tags)).toBe(kind));

  it("leaves food, garages, fuel, banks and schools without a kind here", () => {
    for (const tags of [
      { amenity: "restaurant", name: "X" },
      { amenity: "cafe", name: "X" },
      { shop: "bakery", name: "X" },
      { shop: "butcher", name: "X" },
      { shop: "car_repair", name: "X" },
      { shop: "tyres", name: "X" },
      { amenity: "fuel", name: "X" },
      { amenity: "bank", name: "X" },
      { amenity: "school", name: "בית ספר יסודי" },
      { amenity: "bench", name: "X" },
    ])
      expect(classify(tags), JSON.stringify(tags)).toBeNull();
  });
  it("hands a kind only from the active kinds it is given", () => {
    expect(classify({ shop: "florist", name: "X" }, { kinds: new Set(["shops"]) })).toBeNull();
  });
});

describe("exclusions", () => {
  it.each([
    [{ amenity: "bar", name: "The Bar" }],
    [{ amenity: "pub", name: "Pub" }],
    [{ amenity: "nightclub", name: "X" }],
    [{ shop: "alcohol", name: "X" }],
    [{ shop: "wine", name: "X" }],
    [{ shop: "convenience", name: "בירה ויין" }],
    [{ shop: "supermarket", name: "יינות ביתן" }],
    [{ craft: "winery", name: "יקב הגליל" }],
    [{ tourism: "attraction", name: "יקב רמת הגולן" }],
    [{ shop: "butcher", name: "Pork & Co" }],
    [{ shop: "deli", name: "חזיר" }],
    [{ shop: "supermarket", name: "טיב טעם" }],
    [{ shop: "supermarket", name: "Tiv Taam", brand: "Tiv Taam" }],
    [{ shop: "lottery", name: "X" }],
    [{ shop: "kiosk", name: "לוטו טוטו" }],
    [{ shop: "convenience", name: "Lotto Point" }],
    [{ amenity: "casino", name: "X" }],
    [{ amenity: "gambling", name: "X" }],
    [{ shop: "e-cigarette", name: "X" }],
    [{ shop: "vape", name: "X" }],
    [{ shop: "yes", name: "Vape City" }],
    [{ shop: "tobacco", name: "X" }],
    [{ shop: "convenience", name: "סיגריות ונרגילות" }],
    [{ shop: "cannabis", name: "X" }],
    [{ shop: "erotic", name: "X" }],
    [{ shop: "yes", name: "Sex Shop" }],
    [{ shop: "tattoo", name: "X" }],
  ])("%j is never listed", (tags) => {
    expect(excluded(tags)).toBeTruthy();
    expect(classify(tags).excluded).toBeTruthy();
  });
  it("lets look-alike names through", () => {
    for (const tags of [
      { shop: "beauty", name: "Brow Bar" },
      { leisure: "swimming_pool", name: "בריכת ברעם" },
      { amenity: "place_of_worship", religion: "jewish", name: "בית כנסת בר יוחאי" },
      { shop: "clothes", name: "Winners Fashion" },
    ])
      expect(excluded(tags), JSON.stringify(tags)).toBeNull();
  });
});

describe("words", () => {
  it("finds Hebrew stems with a prefix letter, Arabic with the article, English case-blind", () => {
    expect(words("ציפורנ").test("וציפורניים")).toBe(true);
    expect(words("ספר$").test("ספרים")).toBe(false);
    expect(words("حلاق").test("الحلاق")).toBe(true);
    expect(words("barber").test("THE BARBER SHOP")).toBe(true);
    expect(words("barber").test("superbarber")).toBe(false);
  });
});
