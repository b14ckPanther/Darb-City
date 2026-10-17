// What an OpenStreetMap food place is in Darb: which places are never listed (bars, alcohol,
// pork, gambling, wineries), the food kinds a place belongs to (packages/seed/data/kinds.json,
// food sector) from its tags, its cuisine and the words in its name, and the dishes its card
// lists so deep search finds "שווארמה" or "فلافل" inside it.

/** Words as whole words, Hebrew and Arabic with one or two attached prefix letters. */
const HE_PREFIX = "(?:[הבלוכמש]|וה|שה|וב|ול|מה|כש)?";
const AR_PREFIX = "(?:ال|وال|بال|لل|و|ب|ل|ف)?";
const L = "\\p{L}";
function wordsRe({ he = [], ar = [], en = [] }) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[\\s_-]*");
  const parts = [];
  if (he.length) parts.push(`(?<!${L})${HE_PREFIX}(?:${he.map(esc).join("|")})(?!${L})`);
  if (ar.length) parts.push(`(?<!${L})${AR_PREFIX}(?:${ar.map(esc).join("|")})(?!${L})`);
  if (en.length) parts.push(`(?<!${L})(?:${en.map(esc).join("|")})(?!${L})`);
  return parts.length ? new RegExp(parts.join("|"), "iu") : /$^/;
}

// --- Never listed --------------------------------------------------------------------------

/** Food words that make "bar" a counter, not a bar ("Juice Bar", "סושי בר", "אספרסו בר"). */
const FOOD_BAR = new RegExp(
  [
    "(?:choco|chocolate|juice|salad|sushi|espresso|coffee|yogh?urt|snack|burger|hummus|humus|sandwich|breakfast|dessert|cereal|smoothie|shake|salat)s?[\\s_-]*bar",
    "(?:מיצים|מיץ|סושי|סלטים|סלט|חומוס|אספרסו|קפה|יוגורט|המבורגר|בורגר|כריכים|סנדוויץ'?|שייקים|קינוחים|שוקו|צ'וקו|פרח)[\\s-]+בר",
    "בר[\\s-]+(?:מיצים|סלטים|חומוס|יוגורט|קינוחים|בשר)",
    // Rebar, the juice chain, written in Hebrew.
    "רי[\\s-]*בר",
  ].join("|"),
  "giu",
);
const BAR_WORDS = wordsRe({
  he: ["בר", "פאב", "פאבים", "מבשלה", "מבשלת"],
  ar: ["بار", "خمارة", "خمّارة", "ملهى"],
  en: [
    "bar",
    "bars",
    "pub",
    "pubs",
    "tavern",
    "nightclub",
    "night club",
    "brewery",
    "brewpub",
    "lounge bar",
  ],
});
const ALCOHOL_WORDS = wordsRe({
  he: [
    "יין",
    "יינות",
    "בירה",
    "בירות",
    "אלכוהול",
    "משקאות חריפים",
    "וויסקי",
    "ויסקי",
    "וודקה",
    "ערק",
    "ליקר",
  ],
  ar: ["نبيذ", "خمر", "خمور", "بيرة", "كحول", "عرق", "ويسكي", "فودكا", "مشروبات روحية"],
  en: [
    "wine",
    "wines",
    "beer",
    "beers",
    "alcohol",
    "liquor",
    "liquors",
    "whisky",
    "whiskey",
    "vodka",
    "arak",
    "spirits",
  ],
});
const PORK_WORDS = wordsRe({
  he: ["חזיר", "חזירים", "בייקון", "בשר לבן"],
  ar: ["خنزير", "لحم خنزير", "بيكون"],
  en: ["pork", "pig", "bacon", "ham", "prosciutto", "salami", "jamon", "jamón", "chorizo", "lard"],
});
const GAMBLING_WORDS = wordsRe({
  he: ["לוטו", "טוטו", "קזינו", "הימורים", "מפעל הפיס", "פיס"],
  ar: ["لوتو", "كازينو", "قمار", "يانصيب"],
  en: ["lotto", "loto", "lottery", "casino", "gambling", "betting"],
});
const WINERY_WORDS = wordsRe({
  he: ["יקב", "יקבי"],
  ar: ["معصرة نبيذ"],
  en: ["winery", "vineyard", "vineyards", "wine cellar"],
});

const yes = (v) => v === "yes" || v === "only" || v === "served";

/** Every name and free text a place has, for word checks. */
export const textsOf = (t = {}) =>
  Object.entries(t)
    .filter(([k]) =>
      /^(name|alt_name|old_name|official_name|brand|operator|description)(:|$)/.test(k),
    )
    .map(([, v]) => v);

/**
 * Why a place is never listed, or null: "bar" (bars, pubs, beer brewed or poured, a name that says bar or pub;
 * a restaurant OSM says only "has a bar" stays a restaurant),
 * "nightclub", "alcohol" (shops and names about drink), "pork", "gambling", "winery".
 */
export function exclusion(t = {}) {
  const names = textsOf(t).join(" | ");
  const cuisine = (t.cuisine ?? "").replace(/_/g, " ");
  if (t.craft === "winery" || t.craft === "distillery" || WINERY_WORDS.test(names)) return "winery";
  if (t.amenity === "nightclub" || t.amenity === "stripclub") return "nightclub";
  if (
    ["gambling", "casino"].includes(t.amenity) ||
    t.shop === "lottery" ||
    t.gambling ||
    GAMBLING_WORDS.test(names)
  )
    return "gambling";
  if (["alcohol", "wine", "beverages", "brewing_supplies"].includes(t.shop)) return "alcohol";
  const allText = [
    names,
    cuisine,
    ...Object.entries(t)
      .filter(([k]) => /^(diet|cuisine|menu|description)/.test(k))
      .map(([, v]) => v),
  ].join(" | ");
  if (PORK_WORDS.test(allText) || /(^|:)pork/.test(Object.keys(t).join(" "))) return "pork";
  if (
    ["bar", "pub", "biergarten"].includes(t.amenity) ||
    t.craft === "brewery" ||
    yes(t.microbrewery) ||
    t.brewery ||
    /(^|;)\s*(bar|pub|beer|bar_and_grill|wine_bar|tapas_bar|beer_garden)\s*(;|$)/.test(
      t.cuisine ?? "",
    ) ||
    BAR_WORDS.test(names.replace(FOOD_BAR, " "))
  )
    return "bar";
  if (
    ["wine", "beer", "alcohol", "spirits", "liquor", "cocktail"].some((d) =>
      yes(t[`drink:${d}`]),
    ) ||
    ALCOHOL_WORDS.test(`${names} | ${cuisine}`)
  )
    return "alcohol";
  return null;
}

// --- Kinds and dishes ------------------------------------------------------------------------

/**
 * Words that say what a place serves: the kind they point to and the dish the card lists.
 * Order matters only for ties; a word's position in the name decides first.
 */
export const DISHES = [
  {
    key: "shawarma",
    kind: "grill",
    label: { he: "שווארמה", ar: "شاورما", en: "Shawarma" },
    words: {
      he: ["שווארמה", "שוארמה", "שווארמא", "שאוורמה", "שווארמות"],
      ar: ["شاورما", "شاورمة", "شاورمه", "شاروما", "شوارما"],
      en: ["shawarma", "shawerma", "shwarma", "schawarma", "shawarmah"],
    },
  },
  {
    key: "kebab",
    kind: "grill",
    label: { he: "קבב", ar: "كباب", en: "Kebab" },
    words: {
      he: ["קבב", "קבבים"],
      ar: ["كباب", "كفتة", "كفته"],
      en: ["kebab", "kebabs", "kabab", "kofta"],
    },
  },
  {
    key: "grill",
    kind: "grill",
    label: { he: "גריל ועל האש", ar: "مشاوي", en: "Grill" },
    words: {
      he: ["גריל", "על האש", "מנגל", "שיפודי", "שיפודים", "שיפוד", "בשרים"],
      ar: ["مشاوي", "مشويات", "شواء", "مشوي", "لحوم"],
      en: ["grill", "grills", "bbq", "barbecue", "barbeque", "grillhouse", "meat", "meats"],
    },
  },
  {
    key: "steak",
    kind: "grill",
    label: { he: "סטייקים", ar: "ستيك", en: "Steaks" },
    words: {
      he: ["סטייק", "סטייקים", "סטקיה", "סטייקיה", "סטייקיית"],
      ar: ["ستيك", "ستيكات"],
      en: ["steak", "steaks", "steakhouse", "steak house"],
    },
  },
  {
    key: "hummus",
    kind: "hummus",
    label: { he: "חומוס", ar: "حمص", en: "Hummus" },
    words: {
      he: ["חומוס", "חומוסיה", "חומוסייה", "חומוסיית", "חומוסיה"],
      ar: ["حمص", "حمّص", "حمصاني", "حمصانية"],
      en: ["hummus", "humus", "houmous", "hommus", "hummous", "humous"],
    },
  },
  {
    key: "falafel",
    kind: "hummus",
    label: { he: "פלאפל", ar: "فلافل", en: "Falafel" },
    words: { he: ["פלאפל"], ar: ["فلافل"], en: ["falafel", "felafel", "falafal"] },
  },
  {
    key: "foul",
    kind: "hummus",
    label: { he: "פול", ar: "فول", en: "Ful" },
    words: { ar: ["فول"], en: ["foul", "ful medames"] },
  },
  {
    key: "knafeh",
    kind: "sweets",
    label: { he: "כנאפה", ar: "كنافة", en: "Knafeh" },
    words: {
      he: ["כנאפה", "כנאפה", "קנאפה", "כנאפות"],
      ar: ["كنافة", "كنافه", "كنافة نابلسية"],
      en: ["knafeh", "kunafa", "kanafeh", "knafe", "kunafeh", "kenafeh"],
    },
  },
  {
    key: "baklava",
    kind: "sweets",
    label: { he: "בקלאווה", ar: "بقلاوة", en: "Baklava" },
    words: {
      he: ["בקלאווה", "בקלווה", "בקלאוה"],
      ar: ["بقلاوة", "بقلاوه"],
      en: ["baklava", "baklawa"],
    },
  },
  {
    key: "qatayef",
    kind: "sweets",
    label: { he: "קטאייף", ar: "قطايف", en: "Qatayef" },
    words: { he: ["קטאייף"], ar: ["قطايف"], en: ["katayef", "qatayef"] },
  },
  {
    key: "sweets",
    kind: "sweets",
    label: { he: "ממתקים ועוגות", ar: "حلويات", en: "Sweets" },
    words: {
      he: [
        "קונדיטוריה",
        "קונדיטוריית",
        "ממתקים",
        "ממתקי",
        "מתוקים",
        "מתוקה",
        "עוגות",
        "עוגה",
        "פטיסרי",
        "קינוחים",
        "סופגניות",
        "וופל",
        "וופלים",
      ],
      ar: ["حلويات", "حلوى", "حلواني", "كيك", "باتيسري", "تحلاية", "سكاكر", "وافل"],
      en: [
        "sweets",
        "sweet",
        "patisserie",
        "pâtisserie",
        "pastry shop",
        "cake",
        "cakes",
        "dessert",
        "desserts",
        "candy",
        "confectionery",
        "donut",
        "donuts",
        "waffle",
        "waffles",
        "crepe",
        "crepes",
      ],
    },
  },
  {
    key: "chocolate",
    kind: "sweets",
    label: { he: "שוקולד", ar: "شوكولاتة", en: "Chocolate" },
    words: {
      he: ["שוקולד", "שוקולדים", "שוקולטרי"],
      ar: ["شوكولاتة", "شوكولاته", "شوكولا"],
      en: ["chocolate", "chocolates", "chocolatier", "chocolaterie"],
    },
  },
  {
    key: "bread",
    kind: "bakeries",
    label: { he: "לחם ומאפים", ar: "خبز ومعجنات", en: "Bread and pastries" },
    words: {
      he: [
        "מאפייה",
        "מאפיה",
        "מאפיית",
        "מאפה",
        "מאפים",
        "לחם",
        "לחמים",
        "פיתות",
        "פיתה",
        "בייגל",
        "בייגלה",
        "טאבון",
        "מאפיות",
      ],
      ar: [
        "مخبز",
        "مخابز",
        "فرن",
        "أفران",
        "افران",
        "معجنات",
        "خبز",
        "مناقيش",
        "مناقيش",
        "فطاير",
        "فطائر",
        "طابون",
      ],
      en: [
        "bakery",
        "bakeries",
        "bakehouse",
        "boulangerie",
        "bread",
        "breads",
        "bagel",
        "bagels",
        "manakish",
        "taboon",
        "pastries",
        "boulanger",
      ],
    },
  },
  {
    key: "coffee",
    kind: "cafes",
    label: { he: "קפה", ar: "قهوة", en: "Coffee" },
    words: {
      he: ["קפה", "בית קפה", "אספרסו", "קפית", "קופי"],
      ar: ["مقهى", "قهوة", "قهوه", "كافيه", "كافيه", "كافي", "كوفي", "كوفي شوب", "اسبريسو"],
      en: [
        "cafe",
        "café",
        "caffe",
        "caffè",
        "coffee",
        "coffeeshop",
        "coffee shop",
        "espresso",
        "kaffee",
        "cafeteria",
      ],
    },
  },
  {
    key: "ice-cream",
    kind: "ice-cream",
    label: { he: "גלידה", ar: "بوظة", en: "Ice cream" },
    words: {
      he: ["גלידה", "גלידות", "גלידריה", "גלידריית", "גלידת", "יוגורט", "פרוזן"],
      ar: ["بوظة", "بوظه", "ايس كريم", "آيس كريم", "جيلاتو", "جيلاتي", "بوظا"],
      en: [
        "ice cream",
        "icecream",
        "gelato",
        "gelateria",
        "frozen yogurt",
        "frozen yoghurt",
        "yogurt",
        "froyo",
      ],
    },
  },
  {
    key: "juice",
    kind: "juice-shops",
    label: { he: "מיצים ושייקים", ar: "عصير وكوكتيل", en: "Juice and smoothies" },
    words: {
      he: ["מיץ", "מיצים", "מיצי", "שייק", "שייקים", "סמוזי", "סמוטי"],
      ar: ["عصير", "عصائر", "عصاير", "كوكتيل فواكه", "سموذي"],
      en: ["juice", "juices", "smoothie", "smoothies", "juicery", "shake", "shakes"],
    },
  },
  {
    key: "catering",
    kind: "catering",
    label: { he: "קייטרינג לאירועים", ar: "كيترينغ للمناسبات", en: "Event catering" },
    words: {
      he: ["קייטרינג", "הסעדה", "קייטרינג"],
      ar: ["كيترينغ", "كاترينغ", "كيترنج", "تموين", "ضيافة"],
      en: ["catering", "caterer", "caterers"],
    },
  },
  {
    key: "butcher",
    kind: "butchers",
    label: { he: "בשר טרי", ar: "لحمة طازة", en: "Fresh meat" },
    words: {
      he: ["אטליז", "אטליזים", "קצביה", "קצב"],
      ar: ["ملحمة", "ملاحم", "لحام", "قصاب", "ملحمه"],
      en: ["butcher", "butchers", "butchery", "boucherie", "meat shop"],
    },
  },
  {
    key: "food-truck",
    kind: "food-trucks",
    label: { he: "פודטראק", ar: "فود ترك", en: "Food truck" },
    words: {
      he: ["פודטראק", "פוד טראק", "פודטרק"],
      ar: ["فود ترك", "فودترك"],
      en: ["food truck", "foodtruck", "food trucks"],
    },
  },
  {
    key: "roastery",
    kind: "roastery",
    label: { he: "קלייה ופיצוחים", ar: "محمص وبزورات", en: "Roasted nuts and seeds" },
    words: {
      he: ["קלייה", "קליית", "פיצוחים", "פיצוחי", "קלית"],
      ar: ["محمص", "محامص", "محمصة", "بزورات", "مكسرات"],
      en: ["roastery", "roasters", "roaster", "nuts"],
    },
  },
  {
    key: "home-food",
    kind: "meal-prep",
    label: { he: "אוכל ביתי", ar: "أكل بيتي", en: "Home cooking" },
    words: {
      he: ["אוכל ביתי", "מטבח ביתי", "בישול ביתי", "מעדנייה", "מעדניה", "מעדניית"],
      ar: ["أكل بيتي", "اكل بيتي", "طبخ بيتي", "اكلات بيتية", "أكلات بيتية"],
      en: ["home cooking", "home food", "homemade food", "deli", "delicatessen"],
    },
  },
  // Dishes that are a restaurant's, not a kind of their own.
  {
    key: "pizza",
    kind: null,
    label: { he: "פיצה", ar: "بيتزا", en: "Pizza" },
    words: {
      he: ["פיצה", "פיצות", "פיצריה", "פיצרייה", "פיצריית"],
      ar: ["بيتزا", "بيتسا", "بيتزيريا"],
      en: ["pizza", "pizzas", "pizzeria", "pizzaria"],
    },
  },
  {
    key: "burger",
    kind: null,
    label: { he: "המבורגר", ar: "برغر", en: "Burgers" },
    words: {
      he: ["המבורגר", "המבורגרים", "בורגר", "בורגרים"],
      ar: ["برغر", "برجر", "همبرغر", "همبرجر", "بيرغر"],
      en: ["burger", "burgers", "hamburger", "hamburgers"],
    },
  },
  {
    key: "sushi",
    kind: null,
    label: { he: "סושי", ar: "سوشي", en: "Sushi" },
    words: { he: ["סושי"], ar: ["سوشي"], en: ["sushi"] },
  },
  {
    key: "fish",
    kind: null,
    label: { he: "דגים", ar: "سمك", en: "Fish" },
    words: {
      he: ["דגים", "דג", "פירות ים"],
      ar: ["سمك", "اسماك", "أسماك", "مأكولات بحرية"],
      en: ["fish", "seafood"],
    },
  },
  {
    key: "chicken",
    kind: null,
    label: { he: "עוף", ar: "دجاج", en: "Chicken" },
    words: {
      he: ["עוף", "עופות", "כנפיים"],
      ar: ["دجاج", "فراخ", "بروستد", "جاج"],
      en: ["chicken", "wings", "broasted"],
    },
  },
  {
    key: "sandwich",
    kind: null,
    label: { he: "כריכים", ar: "سندويشات", en: "Sandwiches" },
    words: {
      he: ["כריכים", "כריך", "סנדוויץ", "סנדביץ", "טוסטים", "בגט"],
      ar: ["سندويشات", "ساندويتشات", "سندويش", "ساندويش", "سندويشة"],
      en: ["sandwich", "sandwiches", "toast", "baguette"],
    },
  },
  {
    key: "pasta",
    kind: null,
    label: { he: "פסטה", ar: "باستا", en: "Pasta" },
    words: { he: ["פסטה", "פסטות"], ar: ["باستا", "معكرونة"], en: ["pasta"] },
  },
  {
    key: "shnitzel",
    kind: null,
    label: { he: "שניצל", ar: "شنيتسل", en: "Schnitzel" },
    words: { he: ["שניצל", "שניצלים"], ar: ["شنيتسل"], en: ["schnitzel", "shnitzel"] },
  },
  {
    key: "salad",
    kind: null,
    label: { he: "סלטים", ar: "سلطات", en: "Salads" },
    words: { he: ["סלטים", "סלט"], ar: ["سلطات", "سلطة"], en: ["salad", "salads"] },
  },
  {
    key: "breakfast",
    kind: null,
    label: { he: "ארוחות בוקר", ar: "فطور", en: "Breakfast" },
    words: {
      he: ["ארוחות בוקר", "ארוחת בוקר"],
      ar: ["فطور", "ترويقة"],
      en: ["breakfast", "brunch"],
    },
  },
];

/** OSM cuisine values to the dishes above, or a label of their own (an origin, a style). */
const CUISINE = {
  shawarma: "shawarma",
  kebab: "kebab",
  doner: "kebab",
  grill: "grill",
  barbecue: "grill",
  bbq: "grill",
  meat: "grill",
  steak_house: "steak",
  steak: "steak",
  hummus: "hummus",
  humus: "hummus",
  falafel: "falafel",
  knafeh: "knafeh",
  baklava: "baklava",
  dessert: "sweets",
  cake: "sweets",
  cakes: "sweets",
  pastry: "sweets",
  waffle: "sweets",
  donut: "sweets",
  crepe: "sweets",
  candy: "sweets",
  chocolate: "chocolate",
  chocolates: "chocolate",
  bakery: "bread",
  bagel: "bread",
  taboon_bread: "bread",
  coffee_shop: "coffee",
  coffee: "coffee",
  cafe: "coffee",
  ice_cream: "ice-cream",
  frozen_yogurt: "ice-cream",
  gelato: "ice-cream",
  juice: "juice",
  smoothies: "juice",
  smoothie: "juice",
  pizza: "pizza",
  italian_pizza: "pizza",
  burger: "burger",
  sushi: "sushi",
  fish: "fish",
  seafood: "fish",
  fish_and_chips: "fish",
  chicken: "chicken",
  fried_chicken: "chicken",
  wings: "chicken",
  sandwich: "sandwich",
  sandwiches: "sandwich",
  pasta: "pasta",
  schnitzel: "shnitzel",
  salad: "salad",
  breakfast: "breakfast",
  deli: "home-food",
  homemade: "home-food",
};
/** Cuisines that are a style or an origin: the card lists them, no kind follows. */
const STYLES = {
  arab: { he: "מטבח ערבי", ar: "أكل عربي", en: "Arab cuisine" },
  arabic: { he: "מטבח ערבי", ar: "أكل عربي", en: "Arab cuisine" },
  lebanese: { he: "מטבח לבנוני", ar: "أكل لبناني", en: "Lebanese" },
  middle_eastern: { he: "מטבח מזרחי", ar: "أكل شرقي", en: "Middle Eastern" },
  oriental: { he: "מטבח מזרחי", ar: "أكل شرقي", en: "Middle Eastern" },
  regional: { he: "מטבח מקומי", ar: "أكل بلدي", en: "Local food" },
  local: { he: "מטבח מקומי", ar: "أكل بلدي", en: "Local food" },
  mediterranean: { he: "ים תיכוני", ar: "متوسطي", en: "Mediterranean" },
  italian: { he: "איטלקי", ar: "إيطالي", en: "Italian" },
  asian: { he: "אסייתי", ar: "آسيوي", en: "Asian" },
  japanese: { he: "יפני", ar: "ياباني", en: "Japanese" },
  chinese: { he: "סיני", ar: "صيني", en: "Chinese" },
  thai: { he: "תאילנדי", ar: "تايلندي", en: "Thai" },
  vietnamese: { he: "וייטנאמי", ar: "فيتنامي", en: "Vietnamese" },
  korean: { he: "קוריאני", ar: "كوري", en: "Korean" },
  indian: { he: "הודי", ar: "هندي", en: "Indian" },
  curry: { he: "קארי", ar: "كاري", en: "Curry" },
  american: { he: "אמריקאי", ar: "أمريكي", en: "American" },
  french: { he: "צרפתי", ar: "فرنسي", en: "French" },
  georgian: { he: "גאורגי", ar: "جورجي", en: "Georgian" },
  moroccan: { he: "מרוקאי", ar: "مغربي", en: "Moroccan" },
  turkish: { he: "טורקי", ar: "تركي", en: "Turkish" },
  russian: { he: "רוסי", ar: "روسي", en: "Russian" },
  ethiopian: { he: "אתיופי", ar: "إثيوبي", en: "Ethiopian" },
  greek: { he: "יווני", ar: "يوناني", en: "Greek" },
  argentinian: { he: "ארגנטינאי", ar: "أرجنتيني", en: "Argentinian" },
  mexican: { he: "מקסיקני", ar: "مكسيكي", en: "Mexican" },
  "tex-mex": { he: "מקסיקני", ar: "مكسيكي", en: "Mexican" },
  caucasian: { he: "קווקזי", ar: "قوقازي", en: "Caucasian" },
  jordanian: { he: "ירדני", ar: "أردني", en: "Jordanian" },
  international: { he: "מטבח בינלאומי", ar: "أكل عالمي", en: "International" },
  soup: { he: "מרקים", ar: "شوربات", en: "Soups" },
  hot_dog: { he: "נקניקיות", ar: "هوت دوغ", en: "Hot dogs" },
  hotdog: { he: "נקניקיות", ar: "هوت دوغ", en: "Hot dogs" },
  noodles: { he: "נודלס", ar: "نودلز", en: "Noodles" },
  tea: { he: "תה", ar: "شاي", en: "Tea" },
  snacks: { he: "חטיפים", ar: "سناكات", en: "Snacks" },
  potato: { he: "צ'יפס", ar: "بطاطا", en: "Fries" },
  chips: { he: "צ'יפס", ar: "بطاطا", en: "Fries" },
};

const DISH = new Map(DISHES.map((d) => [d.key, { ...d, re: wordsRe(d.words) }]));

/** Dishes named in a text, in the order they appear: [{ key, at }]. */
export function dishesIn(text) {
  const out = [];
  for (const d of DISH.values()) {
    const m = d.re.exec(text ?? "");
    if (m) out.push({ key: d.key, at: m.index });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** The labels a place's cuisine tag gives: dishes and styles; anything else read for words. */
export function cuisineOf(t = {}) {
  const dishes = [];
  const styles = [];
  for (const raw of (t.cuisine ?? "").split(/[;,]/)) {
    const v = raw.trim().toLowerCase();
    if (!v) continue;
    if (CUISINE[v]) dishes.push(CUISINE[v]);
    else if (STYLES[v]) styles.push(STYLES[v]);
    else for (const d of dishesIn(v.replace(/_/g, " "))) dishes.push(d.key);
  }
  return { dishes: [...new Set(dishes)], styles };
}

/** What a shop or craft tag alone says the place is. */
const BY_TAG = [
  [(t) => t.shop === "butcher", "butchers"],
  [(t) => t.craft === "caterer" || t.office === "catering" || t.shop === "catering", "catering"],
  [(t) => t.shop === "coffee" || t.shop === "nuts", "roastery"],
  [(t) => t.shop === "juice" || t.amenity === "juice_bar", "juice-shops"],
  [(t) => t.amenity === "ice_cream" || t.shop === "ice_cream", "ice-cream"],
  [(t) => t.shop === "bakery", "bakeries"],
  [
    (t) => ["pastry", "confectionery", "chocolate"].includes(t.shop) || t.craft === "confectionery",
    "sweets",
  ],
  [(t) => t.shop === "deli", "meal-prep"],
  [(t) => t.street_vendor === "yes" && t.amenity === "fast_food", "food-trucks"],
];
const EATERIES = new Set(["restaurant", "fast_food", "cafe", "food_court"]);

/** Whether OSM calls the place one Darb lists as food. */
export const isFoodPlace = (t = {}) => EATERIES.has(t.amenity) || BY_TAG.some(([test]) => test(t));

/**
 * { kinds, dishes, styles }: the primary kind first, at most three kinds; `dishes` are DISHES
 * keys for the card, `styles` cuisine labels. Null for a place that is not food.
 */
export function classify(t = {}) {
  if (!isFoodPlace(t)) return null;
  const names = [t["name:he"], t["name:ar"], t["name:en"], t.name, t.brand]
    .filter(Boolean)
    .join(" | ");
  const inName = dishesIn(names).map((d) => d.key);
  const cuisine = cuisineOf(t);
  const dishes = [...new Set([...inName, ...cuisine.dishes])];
  const kindOf = (key) => DISH.get(key)?.kind ?? null;
  const fromName = inName.map(kindOf).filter(Boolean);
  // A cuisine list's first value is what the place is; a later one ("pizza;dessert") is a side.
  const fromCuisine = cuisine.dishes.slice(0, 1).map(kindOf).filter(Boolean);

  const byTag = BY_TAG.find(([test]) => test(t))?.[1];
  let primary;
  if (byTag) primary = byTag;
  else if (fromName.length) primary = fromName[0];
  else if (t.amenity === "cafe") primary = "cafes";
  else if (fromCuisine.length) primary = fromCuisine[0];
  else primary = "restaurants";

  const kinds = [primary];
  const add = (k) => k && !kinds.includes(k) && kinds.push(k);
  // A later cuisine counts as a kind when it is a staple ("shawarma;falafel" is also falafel),
  // not a side ("pizza;dessert" is no sweet shop).
  const staples = cuisine.dishes
    .slice(1)
    .map(kindOf)
    .filter((k) => k === "grill" || k === "hummus");
  for (const k of [...fromName, ...fromCuisine, ...staples]) add(k);
  if (t.amenity === "cafe") add("cafes");
  if (t.amenity === "restaurant") add("restaurants");
  return { kinds: kinds.slice(0, 3), dishes, styles: cuisine.styles };
}

export const dishLabel = (key) => DISH.get(key)?.label ?? null;
