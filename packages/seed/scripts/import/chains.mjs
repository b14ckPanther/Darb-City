// Chains for OSM listings: a branch carries its chain as its Darb brand. A branch is the chain's
// when its OSM brand or brand:wikidata says so, or its name starts with the chain's name.
// `kinds` limits a chain to the kinds it can be ("מכבי" is a health fund only at a clinic).
import { words } from "./kind-map.mjs";

const C = (slug, he, ar, en, names, extra = {}) => ({
  slug,
  name: { he, ar, en },
  match: words(...names),
  ...extra,
});

export const CHAINS = [
  // supermarkets and general stores
  C("shufersal", "שופרסל", "شوفرسال", "Shufersal", ["שופרסל", "shufersal", "شوفرسال"], {
    wikidata: "Q2088346",
  }),
  C("rami-levy", "רמי לוי", "رامي ليفي", "Rami Levy", ["רמי לוי", "rami levy", "رامي ليفي"], {
    wikidata: "Q3105470",
  }),
  C("osher-ad", "אושר עד", "أوشر عاد", "Osher Ad", ["אושר עד", "osher ad"], {
    wikidata: "Q7106904",
  }),
  C("victory", "ויקטורי", "فيكتوري", "Victory", ["ויקטורי", "victory"], { kinds: ["shops"] }),
  C("yochananof", "יוחננוף", "يوحنانوف", "Yochananof", ["יוחננוף", "yochananof"]),
  C("hatzi-hinam", "חצי חינם", "حتسي حينام", "Hatzi Hinam", ["חצי חינם", "hatzi hinam"]),
  C("carrefour", "קרפור", "كارفور", "Carrefour", ["קרפור", "carrefour", "كارفور"]),
  C("super-yuda", "סופר יודה", "سوبر يودا", "Super Yuda", ["סופר יודה", "super yuda"]),
  C("mahsanei-hashuk", "מחסני השוק", "محسني هشوك", "Mahsanei Hashuk", [
    "מחסני השוק",
    "mahsanei hashuk",
  ]),
  C("zol-vebegadol", "זול ובגדול", "زول فبجدول", "Zol VeBegadol", [
    "זול ובגדול",
    "zol vbegadol",
    "zol vebegadol",
  ]),
  C("max-stock", "מקס סטוק", "ماكس ستوك", "Max Stock", ["מקס סטוק", "max stock", "maxstock"]),
  C("hamashbir", "המשביר לצרכן", "هماشبير", "Hamashbir", ["המשביר", "hamashbir"]),
  C("good-pharm", "גוד פארם", "جود فارم", "Good Pharm", ["גוד פארם", "good pharm"]),
  // pharmacies and health funds
  C(
    "super-pharm",
    "סופר-פארם",
    "سوبر فارم",
    "Super-Pharm",
    ["סופר-פארם", "סופר פארם", "super-pharm", "super pharm", "سوبر فارم"],
    { wikidata: "Q7643008" },
  ),
  C("be-pharm", "BE", "BE", "BE", ["be פארם", "בי פארם", "be pharm"]),
  C("new-pharm", "ניו-פארם", "نيو فارم", "New Pharm", [
    "ניו-פארם",
    "ניו פארם",
    "new pharm",
    "new-pharm",
  ]),
  C("clalit", "כללית", "كلاليت", "Clalit", ["כללית", "clalit", "كلاليت", "كلاليط"], {
    wikidata: "Q1065568",
    kinds: [
      "public-clinics",
      "pharmacies",
      "dental",
      "optics",
      "physio",
      "pediatric",
      "dermatology",
      "emergency",
      "therapy",
      "speech-therapy",
      "occupational-therapy",
      "nutrition",
    ],
  }),
  C(
    "maccabi-health",
    "מכבי שירותי בריאות",
    "مكابي",
    "Maccabi Healthcare",
    ["מכבי שירותי בריאות", "מכבי", "maccabi", "مكابي"],
    {
      wikidata: "Q6721749",
      kinds: [
        "public-clinics",
        "pharmacies",
        "dental",
        "optics",
        "physio",
        "pediatric",
        "dermatology",
        "therapy",
        "speech-therapy",
        "occupational-therapy",
        "nutrition",
      ],
    },
  ),
  C("meuhedet", "מאוחדת", "مئوحيدت", "Meuhedet", ["מאוחדת", "meuhedet", "مئوحيدت"], {
    wikidata: "Q6941088",
    kinds: [
      "public-clinics",
      "pharmacies",
      "dental",
      "optics",
      "physio",
      "pediatric",
      "dermatology",
      "therapy",
      "speech-therapy",
      "occupational-therapy",
      "nutrition",
    ],
  }),
  C("leumit", "לאומית", "لئوميت", "Leumit", ["לאומית", "leumit", "لئوميت"], {
    wikidata: "Q6531116",
    kinds: [
      "public-clinics",
      "pharmacies",
      "dental",
      "optics",
      "physio",
      "pediatric",
      "dermatology",
      "therapy",
      "speech-therapy",
      "occupational-therapy",
      "nutrition",
    ],
  }),
  C(
    "mda",
    "מגן דוד אדום",
    "نجمة داود الحمراء",
    "Magen David Adom",
    ['מד"א', "מגן דוד אדום", "magen david adom", "mda"],
    { kinds: ["emergency"] },
  ),
  C(
    "israel-post",
    "דואר ישראל",
    "البريد",
    "Israel Post",
    ["דואר ישראל", "israel post", "בית דואר", "דואר "],
    { wikidata: "Q1550489", kinds: ["post-offices"] },
  ),
  // fashion
  C("fox", "פוקס", "فوكس", "Fox", ["פוקס", "fox$"], {
    kinds: ["fashion", "kids-clothing", "decor", "shops"],
  }),
  C("castro", "קסטרו", "كاسترو", "Castro", ["קסטרו", "castro"]),
  C("golf", "גולף", "جولف", "Golf", ["גולף", "golf"], {
    kinds: ["fashion", "kitchenware", "decor", "shops", "kids-clothing"],
  }),
  C("renuar", "רנואר", "رينوار", "Renuar", ["רנואר", "renuar"]),
  C("hm", "H&M", "H&M", "H&M", ["h&m"]),
  C("zara", "זארה", "زارا", "Zara", ["זארה", "zara"]),
  C("american-eagle", "אמריקן איגל", "أمريكان إيجل", "American Eagle", [
    "אמריקן איגל",
    "american eagle",
  ]),
  C("honigman", "הוניגמן", "هونيجمان", "Honigman", ["הוניגמן", "honigman"]),
  C("tamnoon", "תמנון", "تمنون", "Tamnoon", ["תמנון", "tamnoon"]),
  C("shilav", "שילב", "شيلاف", "Shilav", ["שילב", "shilav"], {
    kinds: ["baby-shops", "kids-clothing", "shops"],
  }),
  C("delta", "דלתא", "دلتا", "Delta", ["דלתא", "delta"], { kinds: ["fashion", "kids-clothing"] }),
  C("aldo", "אלדו", "ألدو", "Aldo", ["אלדו", "aldo"], { kinds: ["fashion"] }),
  C("nike", "נייקי", "نايكي", "Nike", ["נייקי", "nike"], { kinds: ["sportswear", "fashion"] }),
  C("adidas", "אדידס", "أديداس", "Adidas", ["אדידס", "adidas"], {
    kinds: ["sportswear", "fashion"],
  }),
  C("decathlon", "דקטלון", "ديكاتلون", "Decathlon", ["דקטלון", "decathlon"]),
  // home
  C("home-center", "הום סנטר", "هوم سنتر", "Home Center", [
    "הום סנטר",
    "home center",
    "homecenter",
  ]),
  C("ace", "ACE", "ACE", "ACE", ["ace$", "אייס"], {
    kinds: ["contractors", "decor", "kitchenware", "shops", "furniture"],
  }),
  C("ikea", "איקאה", "ايكيا", "IKEA", ["איקאה", "ikea"]),
  C("kravitz", "קרביץ", "كرافيتس", "Kravitz", ["קרביץ", "kravitz"]),
  C("office-depot", "אופיס דיפו", "أوفيس ديبو", "Office Depot", ["אופיס דיפו", "office depot"]),
  C("tzomet-sfarim", "צומת ספרים", "تسومت سفاريم", "Tzomet Sfarim", [
    "צומת ספרים",
    "tzomet sfarim",
  ]),
  C("steimatzky", "סטימצקי", "ستيماتسكي", "Steimatzky", ["סטימצקי", "steimatzky"]),
  C("toys-r-us", "טויס אר אס", "تويز آر أص", "Toys R Us", ["טויס אר אס", "toys r us", "toysrus"]),
  C("kfar-hashaashuim", "כפר השעשועים", "كفر هشعشوعيم", "Kfar Hashaashuim", ["כפר השעשועים"]),
  // electronics and phones
  C("ksp", "KSP", "KSP", "KSP", ["ksp$"]),
  C("bug", "באג", "باج", "Bug", ["באג$", "bug$"], {
    kinds: ["electronics", "it-support", "device-repair"],
  }),
  C("idigital", "iDigital", "iDigital", "iDigital", ["idigital", "איי דיגיטל"]),
  C("mahsanei-hashmal", "מחסני חשמל", "محسني حشمال", "Mahsanei Hashmal", [
    "מחסני חשמל",
    "mahsanei hashmal",
  ]),
  C("partner", "פרטנר", "بارتنر", "Partner", ["פרטנר", "partner$"], {
    kinds: ["electronics", "it-support", "device-repair"],
  }),
  C("cellcom", "סלקום", "سيلكوم", "Cellcom", ["סלקום", "cellcom"]),
  C("pelephone", "פלאפון", "بلفون", "Pelephone", ["פלאפון", "pelephone"]),
  C("hot", "HOT", "HOT", "HOT", ["hot$", "הוט$"], { kinds: ["electronics", "it-support"] }),
  C("bezeq", "בזק", "بيزك", "Bezeq", ["בזק", "bezeq"]),
  // optics
  C("opticana", "אופטיקנה", "أوبتيكانا", "Opticana", ["אופטיקנה", "opticana"]),
  C(
    "optica-halperin",
    "אופטיקה הלפרין",
    "أوبتيكا هالبرين",
    "Optica Halperin",
    ["הלפרין", "halperin"],
    { kinds: ["optics"] },
  ),
  C("carolina-lemke", "קרולינה למקה", "كارولينا ليمكي", "Carolina Lemke", [
    "קרולינה למקה",
    "carolina lemke",
  ]),
  // gyms
  C("holmes-place", "הולמס פלייס", "هولمز بليس", "Holmes Place", ["הולמס פלייס", "holmes place"]),
  C("go-active", "גו אקטיב", "جو أكتيف", "Go Active", ["גו אקטיב", "go active"]),
  // car rental
  C("eldan", "אלדן", "إلدان", "Eldan", ["אלדן", "eldan"], { kinds: ["car-rental", "dealers"] }),
  C("hertz", "הרץ", "هيرتس", "Hertz", ["הרץ", "hertz"], { kinds: ["car-rental"] }),
  C("avis", "אוויס", "أفيس", "Avis", ["אוויס", "avis"], { kinds: ["car-rental"] }),
  C("budget", "באדג'ט", "بادجت", "Budget", ["באדג'ט", "budget"], { kinds: ["car-rental"] }),
  C("shlomo-sixt", "שלמה סיקסט", "شلومو سيكست", "Shlomo Sixt", ["שלמה סיקסט", "sixt"], {
    kinds: ["car-rental"],
  }),
  C("albar", "אלבר", "ألبار", "Albar", ["אלבר", "albar"], { kinds: ["car-rental", "dealers"] }),
];

const byWikidata = new Map(CHAINS.filter((c) => c.wikidata).map((c) => [c.wikidata, c]));

/** The chain a feature belongs to, or null. `kinds` are the feature's Darb kinds. */
export function chainOf(tags, kinds = []) {
  const fits = (c) => !c.kinds || kinds.some((k) => c.kinds.includes(k));
  const wd = byWikidata.get(tags["brand:wikidata"]);
  if (wd && fits(wd)) return wd;
  for (const text of [tags.brand, tags["brand:he"], tags["brand:en"]].filter(Boolean)) {
    const c = CHAINS.find((x) => x.match.test(text) && fits(x));
    if (c) return c;
  }
  // By name: the chain's name must open the name ("שופרסל דיל כרמיאל").
  for (const name of [tags.name, tags["name:he"], tags["name:en"], tags["name:ar"]].filter(
    Boolean,
  )) {
    const c = CHAINS.find((x) => {
      const m = x.match.exec(name);
      return m && m.index <= 1 && fits(x);
    });
    if (c) return c;
  }
  return null;
}
