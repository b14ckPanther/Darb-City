// Which Darb kind an OpenStreetMap feature is: its tags first, then words in its names (Hebrew,
// Arabic, English). Every active kind outside food has an entry in KIND_INFO, with the tags and
// words that find it, or a note on why OpenStreetMap cannot. Exclusions come before everything:
// no bars, alcohol, pork, gambling or lottery, adult shops, tobacco, vape or cannabis.

/** Sectors and kinds this importer never writes: other importers own them. */
export const OWNED_ELSEWHERE = {
  sectors: new Set(["food"]),
  kinds: new Set([
    // Ministry of Transport register (garages importer).
    "garages",
    "vehicle-testing",
    "body-shops",
    "tyres",
    // Phase 1: fuel, banks and EV charging have their own official lists.
    "stations",
    "banks",
    "ev-charging",
  ]),
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const HEBREW = /[א-ת]/;
const ARABIC = /[؀-ۿ]/;

/**
 * A regex finding any of `list` at the start of a word: Hebrew may carry one prefix letter
 * (ה ו ב ל מ ש כ), Arabic an article or conjunction (ال و ب لل), English is case-blind. Words
 * are stems: "ציפורנ" finds ציפורניים. A trailing "$" makes a word whole ("ספר$").
 */
export function words(...list) {
  const part = (w) => {
    const whole = w.endsWith("$");
    const body = escape(whole ? w.slice(0, -1) : w).replace(/"/g, `["״']{1,2}`);
    return whole ? `${body}(?![\\p{L}])` : body;
  };
  const he = list.filter((w) => HEBREW.test(w)).map(part);
  const ar = list.filter((w) => ARABIC.test(w)).map(part);
  const en = list.filter((w) => !HEBREW.test(w) && !ARABIC.test(w)).map(part);
  const alts = [];
  if (he.length) alts.push(`[הובלמשכ]?(?:${he.join("|")})`);
  if (ar.length) alts.push(`(?:ال|وال|بال|لل|و|ب)?(?:${ar.join("|")})`);
  if (en.length) alts.push(`(?:${en.join("|")})`);
  return new RegExp(`(?:^|[^\\p{L}])(?:${alts.join("|")})`, "iu");
}

/** Every name a feature carries, as one text for word rules. */
export function nameText(tags) {
  return Object.entries(tags)
    .filter(([k]) => /^(name|name:(he|ar|en)|alt_name|old_name|brand|short_name)$/.test(k))
    .map(([, v]) => v)
    .join(" | ")
    .replace(/״/g, '"')
    .replace(/׳/g, "'");
}

/**
 * A tag condition: "shop=hairdresser|beauty", "healthcare:speciality~paediatrics" (one of a
 * ;-list), "shop=*", "!access=private"; several joined by "&".
 */
export function tagTest(spec) {
  const parts = spec.split("&").map((c) => {
    const not = c.startsWith("!");
    const body = not ? c.slice(1) : c;
    // "amenity=dentist|healthcare=dentist": an item with its own key starts another group.
    const groups = [];
    for (const item of body.split("|")) {
      const m = /^([^=~]+)([=~])(.+)$/.exec(item);
      if (m) groups.push({ key: m[1], op: m[2], values: [m[3]] });
      else if (groups.length) groups.at(-1).values.push(item);
      else throw new Error(`bad tag spec ${spec}`);
    }
    const test = (tags) =>
      groups.some(({ key, op, values }) => {
        const v = tags[key];
        if (v === undefined) return false;
        if (values.includes("*")) return v !== "no";
        if (op === "=") return values.includes(v);
        const list = v.split(";").map((x) => x.trim());
        return values.some((x) => list.includes(x));
      });
    return not ? (tags) => !test(tags) : test;
  });
  return (tags) => parts.every((p) => p(tags));
}

// ---------------------------------------------------------------------------------------------
// Exclusions: checked before any kind. Tags first, then words in the names.

const EXCLUDED_TAGS = [
  [
    "amenity=bar|pub|nightclub|biergarten|casino|gambling|stripclub|brothel|swingerclub|love_hotel|hookah_lounge",
    "bar or nightlife",
  ],
  ["shop=alcohol|wine|beverages|brewing_supplies", "alcohol shop"],
  ["craft=winery|brewery|distillery", "alcohol maker"],
  [
    "shop=tobacco|e-cigarette|cannabis|hookah|vape|smoke|smokeshop|cigarettes|shisha",
    "tobacco, vape or cannabis",
  ],
  ["shop=erotic|sex|adult", "adult shop"],
  ["shop=lottery|bookmaker|betting", "gambling or lottery"],
  ["leisure=adult_gaming_centre", "gambling or lottery"],
  ["shop=tattoo", "tattoo"],
  ["shop=weapons", "weapons"],
  ["landuse=vineyard", "alcohol maker"],
  [
    "amenity=place_of_worship&religion=*&!religion=muslim|christian|jewish|druze|bahai",
    "worship of another faith",
  ],
];
const EXCLUDED_WORDS = [
  [
    words(
      "פאב$",
      "pub$",
      "בר יין",
      "wine",
      "winery",
      "יקב",
      "יינות",
      "יין$",
      "בירה$",
      "craft beer",
      "beer garden",
      "beer house",
      "brewery",
      "מבשלת",
      "liquor",
      "אלכוהול",
      "משקאות חריפים",
      "cocktail",
      "קוקטייל",
      "lounge bar",
      "نبيذ",
      "خمور",
      "خمارة",
      "بيرة",
      "كحول",

      "حانة",
    ),
    "alcohol in the name",
  ],
  [words("pork", "חזיר", "خنزير"), "pork"],
  [
    words(
      "casino",
      "קזינו",
      "كازينو",
      "lotto",
      "לוטו$",
      "טוטו$",
      "toto$",
      "ווינר$",
      "winner$",
      "מפעל הפיס",
      "הפיס$",
      "lottery",
      "يانصيب",
      "قمار",
    ),
    "gambling or lottery",
  ],
  [
    words(
      "vape",
      "וייפ",
      "סיגר",
      "cigar",
      "טבק",
      "tobacco",
      "smoke shop",
      "נרגיל",
      "hookah",
      "شيشة",
      "أرجيلة",
      "ارجيلة",
      "دخان",
      "cannabis",
      "קנאביס",
      "cbd$",
    ),
    "tobacco, vape or cannabis",
  ],
  [words("sex shop", "סקס", "erotic", "ארוטי", "צעצועי מין", "adult shop"), "adult shop"],
  [words("tattoo", "קעקוע", "تاتو$", "טאטו$"), "tattoo"],
];
const excludedTagTests = EXCLUDED_TAGS.map(([spec, why]) => [tagTest(spec), why]);

/** Why a feature is never listed, or null. */
export function excluded(tags) {
  for (const [test, why] of excludedTagTests) if (test(tags)) return why;
  const text = nameText(tags);
  for (const [re, why] of EXCLUDED_WORDS) if (re.test(text)) return why;
  return null;
}

// ---------------------------------------------------------------------------------------------
// Kinds. `one` is a single business of the kind (card title and tagline).

const K = (he, ar, en) => ({ he, ar, en });
/** What one business of each kind is called, and notes for kinds OSM rarely or never holds. */
export const KIND_INFO = {
  // beauty
  barbershops: { one: K("מספרה לגברים", "صالون حلاقة", "Barbershop") },
  salons: { one: K("מספרה", "صالون شعر", "Hair salon") },
  nails: { one: K("ציפורניים ומניקור", "صالون أظافر", "Nail salon") },
  makeup: { one: K("איפור", "مكياج", "Makeup artist") },
  spas: { one: K("ספא ועיסוי", "سبا ومساج", "Spa and massage") },
  brows: { one: K("גבות וריסים", "حواجب ورموش", "Brows and lashes") },
  "ladies-spa": { one: K("ספא לנשים", "سبا للسيدات", "Women's spa") },
  aesthetic: { one: K("אסתטיקה ולייזר", "تجميل وليزر", "Aesthetics and laser") },
  sugaring: { one: K("הסרת שיער", "إزالة شعر", "Hair removal") },
  facials: { one: K("קוסמטיקאית", "تجميل وعناية بالبشرة", "Beauty salon") },
  cosmetics: { one: K("חנות קוסמטיקה", "محل مستحضرات تجميل", "Cosmetics shop") },
  "hair-clinics": { one: K("מרפאת שיער", "عيادة شعر", "Hair clinic") },
  // health
  yoga: { one: K("סטודיו ליוגה ופילאטיס", "استوديو يوغا وبيلاتس", "Yoga and Pilates studio") },
  dental: { one: K("מרפאת שיניים", "عيادة أسنان", "Dental clinic") },
  physio: { one: K("פיזיותרפיה", "علاج طبيعي", "Physiotherapy") },
  nutrition: { one: K("דיאטנית", "أخصائية تغذية", "Dietitian") },
  therapy: { one: K("טיפול ופסיכולוגיה", "علاج نفسي", "Therapy and psychology") },
  optics: { one: K("אופטיקה", "نظارات وبصريات", "Optician") },
  vets: { one: K("מרפאה וטרינרית", "عيادة بيطرية", "Vet clinic") },
  pharmacies: { one: K("בית מרקחת", "صيدلية", "Pharmacy") },
  "speech-therapy": { one: K("קלינאית תקשורת", "علاج نطق", "Speech therapy") },
  dermatology: { one: K("רופא עור", "طبيب جلدية", "Dermatologist") },
  "occupational-therapy": { one: K("ריפוי בעיסוק", "علاج وظيفي", "Occupational therapy") },
  orthodontics: { one: K("יישור שיניים", "تقويم أسنان", "Orthodontist") },
  // sports
  gyms: { one: K("חדר כושר", "جيم", "Gym") },
  trainers: {
    one: K("אימון אישי", "مدرب شخصي", "Personal trainer"),
    note: "people more than places; OSM rarely maps them",
  },
  "football-academies": { one: K("בית ספר לכדורגל", "أكاديمية كرة قدم", "Football school") },
  "sports-clubs": { one: K("מועדון ספורט", "نادي رياضي", "Sports club") },
  "martial-arts": { one: K("אומנויות לחימה", "فنون قتالية", "Martial arts") },
  padel: { one: K("פאדל וטניס", "بادل وتنس", "Padel and tennis") },
  "aquatic-centres": { one: K("בריכה", "بركة سباحة", "Swimming pool") },
  "running-clubs": {
    one: K("קבוצת ריצה", "مجموعة ركض", "Running group"),
    note: "groups meet outdoors; OSM has no tag for them",
  },
  sportswear: { one: K("ציוד וביגוד ספורט", "ملابس ومعدات رياضة", "Sports shop") },
  hiking: {
    one: K("טיולים והדרכה", "رحلات مشي", "Hiking"),
    note: "trails are not businesses; only named guiding outfits count",
  },
  bikes: { one: K("חנות אופניים", "محل بسكليتات", "Bike shop") },
  fishing: { one: K("ציוד דיג", "معدات صيد", "Fishing gear") },
  // kids
  daycare: { one: K("מעון ופעוטון", "حضانة", "Daycare") },
  kindergartens: { one: K("גן ילדים", "روضة أطفال", "Kindergarten") },
  "baby-shops": { one: K("מוצרי תינוקות", "مستلزمات أطفال", "Baby shop") },
  pediatric: { one: K("רופא ילדים", "طبيب أطفال", "Pediatrician") },
  "kids-clothing": { one: K("בגדי ילדים", "ملابس أطفال", "Kids' clothes") },
  nannies: {
    one: K("בייביסיטר", "جليسة أطفال", "Babysitter"),
    note: "private people, never on OSM; needs sign-ups",
  },
  swimming: { one: K("שיעורי שחייה", "دروس سباحة", "Swimming lessons") },
  "kids-dentists": { one: K("רופא שיניים לילדים", "طبيب أسنان أطفال", "Kids' dentist") },
  toys: { one: K("חנות צעצועים", "محل ألعاب", "Toy shop") },
  entertainers: {
    one: K("הפעלות לימי הולדת", "فعاليات أعياد ميلاد", "Party entertainer"),
    note: "home businesses, never on OSM; needs sign-ups",
  },
  "kids-venues": { one: K("מתחם לילדים", "مكان ألعاب للأطفال", "Kids' venue") },
  // education
  tutors: { one: K("שיעורים פרטיים", "دروس خصوصية", "Tutoring") },
  "art-schools": { one: K("חוגי מוזיקה ואמנות", "دورات موسيقى وفن", "Music and art classes") },
  coding: { one: K("חוגי תכנות ורובוטיקה", "دورات برمجة وروبوتيكا", "Coding and robotics") },
  courses: { one: K("קורסים והדרכה", "دورات وتدريب", "Courses and training") },
  "language-schools": { one: K("לימוד שפות", "تعليم لغات", "Language school") },
  psychometric: { one: K("הכנה לפסיכומטרי", "تحضير للبسيخومتري", "Psychometric prep") },
  driving: { one: K("בית ספר לנהיגה", "مدرسة سياقة", "Driving school") },
  "islamic-schools": { one: K("בית ספר אסלאמי", "مدرسة إسلامية", "Islamic school") },
  vocational: {
    one: K("מכללה והכשרה מקצועית", "كلية وتأهيل مهني", "College and vocational training"),
  },
  "cooking-schools": { one: K("סדנאות בישול", "ورشات طبخ", "Cooking classes") },
  sewing: { one: K("תפירה וחומרי תפירה", "خياطة ولوازمها", "Sewing") },
  // tech
  "software-studios": { one: K("פיתוח תוכנה", "تطوير برمجيات", "Software house") },
  "it-support": { one: K("מחשבים ותמיכה טכנית", "كمبيوترات ودعم فني", "Computers and IT support") },
  coworking: { one: K("חלל עבודה משותף", "مساحة عمل مشتركة", "Coworking space") },
  cybersecurity: { one: K("אבטחת מידע", "أمن معلومات", "Cybersecurity") },
  saas: { one: K("חברת הייטק", "شركة هايتك", "Tech company") },
  "marketing-agencies": { one: K("שיווק ופרסום", "تسويق وإعلان", "Marketing and advertising") },
  "social-media": {
    one: K("ניהול סושיאל", "إدارة سوشال ميديا", "Social media management"),
    note: "online services; OSM has no tag",
  },
  hosting: {
    one: K("אחסון אתרים", "استضافة مواقع", "Web hosting"),
    note: "online services; OSM has no tag",
  },
  "app-developers": { one: K("פיתוח אפליקציות", "تطوير تطبيقات", "App development") },
  "game-studios": { one: K("פיתוח משחקים", "تطوير ألعاب", "Game studio") },
  "ai-consulting": { one: K("בינה מלאכותית ודאטה", "ذكاء اصطناعي وبيانات", "AI and data") },
  // services
  lawyers: { one: K("משרד עורכי דין", "مكتب محاماة", "Law office") },
  accountants: { one: K("רואה חשבון", "مكتب محاسبة", "Accountant") },
  insurance: { one: K("סוכנות ביטוח", "وكالة تأمين", "Insurance agency") },
  "real-estate": { one: K('תיווך נדל"ן', "مكتب عقارات", "Real estate agent") },
  contractors: {
    one: K("שיפוצים וחומרי בניין", "ترميم ومواد بناء", "Renovation and building supplies"),
  },
  cleaning: { one: K("חברת ניקיון", "شركة تنظيف", "Cleaning company") },
  technicians: {
    one: K("חשמל, אינסטלציה ומיזוג", "كهرباء وسباكة وتكييف", "Electrics, plumbing and AC"),
  },
  "device-repair": { one: K("מעבדת תיקונים", "تصليح أجهزة", "Repair lab") },
  movers: { one: K("הובלות", "نقليات", "Movers") },
  tailoring: { one: K("תופרת, מכבסה וניקוי יבש", "خياطة ومصبغة", "Tailor and dry cleaning") },
  "glass-aluminium": { one: K("אלומיניום וזגגות", "ألمنيوم وزجاج", "Aluminium and glass") },
  // home
  architects: {
    one: K("אדריכלות ועיצוב פנים", "هندسة معمارية وتصميم داخلي", "Architect and interior design"),
  },
  furniture: { one: K("חנות רהיטים", "محل أثاث", "Furniture shop") },
  kitchens: { one: K("מטבחים", "مطابخ", "Kitchens") },
  curtains: { one: K("וילונות ובדים", "برادي وأقمشة", "Curtains and fabrics") },
  solar: { one: K("מערכות סולאריות", "طاقة شمسية", "Solar systems") },
  decor: { one: K("עיצוב ואביזרים לבית", "ديكور وإكسسوارات للبيت", "Home decor") },
  pools: { one: K("ציוד ותחזוקת בריכות", "صيانة برك", "Pool supplies and care") },
  gardeners: { one: K("גינון ועיצוב נוף", "تنسيق حدائق", "Gardening and landscaping") },
  locksmiths: { one: K("מנעולן", "مفاتيح وأقفال", "Locksmith") },
  "pest-control": { one: K("הדברה", "مكافحة حشرات", "Pest control") },
  painters: { one: K("צבע וצביעה", "دهان ودهانات", "Paint and painters") },
  upholstery: { one: K("ריפוד", "تنجيد", "Upholstery") },
  // industry
  factories: { one: K("מפעל", "مصنع", "Factory") },
  wholesalers: { one: K("סיטונאות והפצה", "بيع بالجملة", "Wholesale") },
  packaging: { one: K("אריזות", "تغليف", "Packaging") },
  couriers: { one: K("שליחויות ולוגיסטיקה", "شحن ولوجستيكا", "Couriers and logistics") },
  warehouses: { one: K("מחסנים ואחסון", "مخازن وتخزين", "Warehouses and storage") },
  "sign-makers": { one: K("שלטים", "يافطات", "Signs") },
  metalworks: { one: K("מסגרייה", "حدادة", "Metalwork") },
  carpentry: { one: K("נגרייה", "نجارة", "Carpentry") },
  recruiting: { one: K("כוח אדם והשמה", "توظيف وقوى عاملة", "Recruitment") },
  security: { one: K("אבטחה ושמירה", "حراسة وأمن", "Security") },
  // auto
  dealers: { one: K("סוכנות ומגרש רכב", "معرض سيارات", "Car dealer") },
  "car-rental": { one: K("השכרת רכב", "تأجير سيارات", "Car rental") },
  "car-wash": { one: K("שטיפת רכב", "غسيل سيارات", "Car wash") },
  motorcycles: { one: K("אופנועים וקטנועים", "دراجات نارية وسكوترات", "Motorbikes and scooters") },
  taxis: { one: K("מוניות והסעות", "تكاسي وسفريات", "Taxis") },
  "auto-parts": { one: K("חלקי חילוף לרכב", "قطع غيار سيارات", "Car parts") },
  towing: { one: K("גרר", "ونش وسحب سيارات", "Towing") },
  // agriculture
  "farm-shops": { one: K("תוצרת חקלאית, פירות וירקות", "خضرة وفواكه من المزرعة", "Farm produce") },
  "farmers-markets": { one: K("שוק", "سوق", "Market") },
  seedlings: { one: K("שתילים וזרעים", "أشتال وبذور", "Seedlings and seeds") },
  beekeepers: { one: K("דבש ומכוורת", "عسل ومناحل", "Honey and beekeeping") },
  dairy: { one: K("מחלבה", "ألبان", "Dairy") },
  "olive-press": { one: K("בית בד", "معصرة زيتون", "Olive press") },
  "egg-farms": { one: K("ביצים", "بيض بلدي", "Eggs") },
  stables: { one: K("חוות סוסים", "إسطبل خيل", "Horse riding") },
  "farm-stays": { one: K("לינה בחווה", "إقامة بالمزرعة", "Farm stay") },
  tractors: { one: K("ציוד חקלאי", "معدات زراعية", "Farm equipment") },
  irrigation: { one: K("השקיה", "ري", "Irrigation") },
  "livestock-vets": { one: K("וטרינר לצאן ובקר", "بيطري للمواشي", "Livestock vet") },
  // events
  venues: { one: K("אולם אירועים", "قاعة أفراح ومناسبات", "Event hall") },
  planners: { one: K("הפקת אירועים", "تنظيم مناسبات", "Event planning") },
  henna: { one: K("חינה", "حناء", "Henna") },
  florists: { one: K("חנות פרחים", "محل ورد", "Florist") },
  "bridal-rental": { one: K("שמלות כלה וערב", "فساتين عرايس وسهرة", "Bridal and evening dresses") },
  photographers: { one: K("צילום", "تصوير", "Photography") },
  printing: { one: K("דפוס והדפסות", "مطبعة وطباعة", "Printing") },
  "escape-rooms": { one: K("חדר בריחה", "غرفة هروب", "Escape room") },
  tents: { one: K("השכרת אוהלים וציוד", "تأجير خيم وكراسي", "Tent and chair rental") },
  "wedding-cakes": {
    one: K("עוגות מעוצבות", "كعكات أعراس", "Wedding cakes"),
    note: "cake makers are in the food importer's bakeries",
  },
  "event-decor": { one: K("עיצוב אירועים ובלונים", "زينة وبالونات", "Event decor and balloons") },
  favours: {
    one: K("מזכרות לאירועים", "توزيعات مناسبات", "Party favours"),
    note: "home businesses; OSM rarely has them",
  },
  // travel
  umrah: { one: K("עומרה וחאג'", "عمرة وحج", "Umrah and Hajj") },
  hotels: { one: K("מלון וצימרים", "فندق وبيوت ضيافة", "Hotel and guesthouse") },
  tours: { one: K("סיורים ואטרקציות", "جولات ومعالم", "Tours and attractions") },
  "travel-agencies": { one: K("סוכנות נסיעות", "مكتب سفريات", "Travel agency") },
  camping: { one: K("קמפינג", "تخييم", "Camping") },
  "tour-buses": { one: K("הסעות ואוטובוסים", "باصات ورحلات", "Bus hire") },
  visas: { one: K("תרגום ומסמכים", "ترجمة ومعاملات", "Translation and documents") },
  "currency-exchange": { one: K("המרת כסף", "صرافة", "Currency exchange") },
  "study-abroad": { one: K('לימודים בחו"ל', "دراسة بالخارج", "Study abroad") },
  luggage: { one: K("תיקים ומזוודות", "شنط وحقائب سفر", "Bags and luggage") },
  "hajj-training": {
    one: K("הכנה לחאג'", "دورات حج", "Hajj course"),
    note: "taught at mosques; OSM has no tag",
  },
  // retail
  shops: { one: K("חנות", "محل", "Shop") },
  fashion: { one: K("בגדים ואופנה", "ملابس وأزياء", "Clothing and fashion") },
  artists: { one: K("אמנות ועבודות יד", "فن وأشغال يدوية", "Art and handmade") },
  bookshops: {
    one: K("ספרים, מתנות וכלי כתיבה", "كتب وهدايا وقرطاسية", "Books, gifts and stationery"),
  },
  "plant-shops": { one: K("משתלה", "مشتل", "Plant nursery") },
  "pet-shops": { one: K("חנות לחיות מחמד", "محل حيوانات أليفة", "Pet shop") },
  gold: { one: K("תכשיטים וזהב", "ذهب ومجوهرات", "Gold and jewellery") },
  perfume: { one: K("בשמים", "عطور", "Perfume") },
  chocolates: { one: K("שוקולד ותמרים", "شوكولاتة وتمور", "Chocolate and dates") },
  electronics: { one: K("סלולר ומוצרי חשמל", "خلويات وكهربائيات", "Phones and electronics") },
  watches: { one: K("שעונים", "ساعات", "Watches") },
  kitchenware: { one: K("כלי בית", "أدوات منزلية", "Housewares") },
  "modest-fashion": { one: K("עבאיות וחיג'אבים", "عبايات وحجابات", "Abayas and hijabs") },
  // religion and community
  mosques: { one: K("מסגד", "مسجد", "Mosque") },
  churches: { one: K("כנסייה", "كنيسة", "Church") },
  synagogues: { one: K("בית כנסת", "كنيس", "Synagogue") },
  "druze-prayer-houses": { one: K("חילווה", "خلوة", "Druze prayer house") },
  "quran-schools": { one: K("לימוד קוראן", "تحفيظ قرآن", "Quran classes") },
  zakat: { one: K("ועדת זכאת", "لجنة زكاة", "Zakat committee") },
  "islamic-books": {
    one: K("ספרי קודש ותשמישי קדושה", "كتب دينية وهدايا", "Religious books and gifts"),
  },
  hijama: { one: K("חיג'אמה", "حجامة", "Hijama") },
  "home-nursing": { one: K("סיעוד", "تمريض ورعاية", "Nursing care") },
  waqf: {
    one: K("ווקף", "وقف", "Waqf"),
    note: "endowments are run through mosques; OSM has no tag",
  },
  mazoun: {
    one: K("מאזון", "مأذون", "Ma'zoun"),
    note: "officiants work from home or court; OSM has no tag",
  },
  thobes: { one: K("ג'לביות ולבוש לגברים", "جلابيات وأثواب", "Thobes and jalabiyas") },
  janazah: { one: K("בית עלמין והלוויות", "مقبرة وخدمات جنازة", "Cemetery and funerals") },
  // civic
  municipal: { one: K("עירייה ומועצה", "بلدية ومجلس", "Council offices") },
  "school-registration": {
    one: K("רישום לבתי ספר", "تسجيل للمدارس", "School registration"),
    note: "a council desk; schools themselves have no Darb kind",
  },
  "public-clinics": { one: K("קופת חולים ומרפאה", "عيادة وصندوق مرضى", "Health fund clinic") },
  libraries: { one: K("ספרייה", "مكتبة عامة", "Library") },
  "post-offices": { one: K("סניף דואר", "بريد", "Post office") },
  buses: { one: K("תחנה מרכזית ורכבת", "محطة باصات وقطار", "Bus and train station") },
  parking: { one: K("חניון", "موقف سيارات", "Car park") },
  permits: { one: K("רישוי והיתרים", "ترخيص وتصاريح", "Permits and licensing") },
  water: { one: K("מים וחשמל", "مي وكهرباء", "Water and electricity") },
  emergency: { one: K("שירותי חירום", "خدمات طوارئ", "Emergency services") },
  // community
  nonprofits: { one: K("עמותה", "جمعية", "Nonprofit") },
  "qard-hasan": { one: K('גמ"ח', "صندوق قرض حسن", "Interest-free loan fund") },
  "community-centres": { one: K('מתנ"ס ומרכז קהילתי', "مركز جماهيري", "Community centre") },
  "senior-centres": { one: K("מרכז לגיל השלישי", "مركز مسنين", "Senior centre") },
  "youth-clubs": { one: K("מועדון נוער", "نادي شبيبة", "Youth club") },
  scouts: { one: K("תנועת נוער וצופים", "كشاف وحركة شبيبة", "Scouts and youth movement") },
  volunteers: { one: K("התנדבות", "تطوع", "Volunteering") },
  "women-coop": { one: K("קואופרטיב נשים", "تعاونية نسائية", "Women's co-op") },
  "community-gardens": { one: K("גינה קהילתית", "حديقة مجتمعية", "Community garden") },
  "charity-shops": { one: K("יד שנייה", "محل مستعمل", "Second-hand shop") },
};

// ---------------------------------------------------------------------------------------------
// Rules, in order: the first that matches gives the primary kind (and `also` more kinds).
// `t` is a tag condition, `w` words in the names; `gate: true` lets a words-only rule match a
// feature only when it has a business key (shop, office, craft, healthcare or a business amenity).

const R = (kind, t, w, extra = {}) => ({ kind, t, w, ...extra });

const BARBER = words("ספר$", "ספרים$", "barber", "חלאק", "حلاق", "بربر", "גברים", "men$", "رجالي");
const KIDS = words("ילדים", "ילד$", "kids", "children", "أطفال", "اطفال", "פעוט");
const MODEST = words(
  "עבאי",
  "עבאיה",
  "חיג'אב",
  "חג'אב",
  "abaya",
  "hijab",
  "jilbab",
  "عباي",
  "حجاب",
  "جلباب",
  "جلابيب",
  "محجبات",
  "شرعي",
);
const BRIDAL = words(
  "כלה$",
  "כלות",
  "bridal",
  "bride",
  "wedding",
  "عرائس",
  "عروس",
  "عرايس",
  "فساتين",
  "שמלות ערב",
  "evening dress",
);
const THOBES = words("ג'לבי", "جلابي", "ثوب", "اثواب", "أثواب", "dishdash", "thobe");
const QURAN = words(
  "قرآن",
  "القران",
  "قران",
  "تحفيظ",
  "تجويد",
  "קוראן",
  "quran",
  "koran",
  "دار القرآن",
);
const ISLAMIC = words(
  "إسلامي",
  "اسلامي",
  "إسلامية",
  "اسلامية",
  "شريعة",
  "الشريعة",
  "שרעי",
  "אסלאמי",
  "איסלאמי",
  "islamic",
  "الدعوة",
);
const UMRAH = words("عمرة", "العمرة", "عمره", "حج$", "الحج", "עומרה", "umrah", "hajj");
const DRUZE = words(
  "خلوة",
  "خلوات",
  "חילווה",
  "חילוות",
  "חלווה",
  "khalwa",
  "khilwa",
  "majlis",
  "مجلس ديني",
);

export const RULES = [
  // ---- religion and community
  R("druze-prayer-houses", "amenity=place_of_worship&religion=druze"),
  R("druze-prayer-houses", "amenity=place_of_worship&denomination=druze"),
  R("druze-prayer-houses", "amenity=place_of_worship", DRUZE),
  R("mosques", "amenity=place_of_worship&religion=muslim"),
  R("churches", "amenity=place_of_worship&religion=christian"),
  R("synagogues", "amenity=place_of_worship&religion=jewish"),
  R(
    "mosques",
    "amenity=place_of_worship",
    words("מסגד", "مسجد", "جامع$", "mosque", "masjid", "جامع "),
  ),
  R(
    "churches",
    "amenity=place_of_worship",
    words("כנסי", "كنيسة", "كنيسه", "church", "דיר$", "دير$", "monastery", "מנזר"),
  ),
  R("synagogues", "amenity=place_of_worship", words("בית כנסת", "בית הכנסת", "synagogue")),
  R("churches", "amenity=monastery"),
  R("janazah", "amenity=grave_yard|funeral_hall|mortuary"),
  R("janazah", "shop=funeral_directors"),
  R("janazah", "office=funeral_services"),
  R("quran-schools", "amenity=school|kindergarten|community_centre|training|social_centre", QURAN),
  R("quran-schools", null, QURAN, { gate: true }),
  R("islamic-books", "shop=religion"),
  R("islamic-books", "shop=books&religion=*"),
  R(
    "islamic-books",
    "shop=books",
    words(
      "ספרי קודש",
      "יודאיקה",
      "judaica",
      "كتب إسلامية",
      "مكتبة إسلامية",
      "تسجيلات إسلامية",
      "تسجيلات اسلامية",
    ),
  ),
  R("thobes", "shop=clothes|fashion|tailor", THOBES),
  R("modest-fashion", "shop=clothes|fashion|boutique|fashion_accessories", MODEST),
  R("hijama", null, words("حجامة", "חיג'אמה", "חג'אמה", "hijama", "cupping"), { gate: true }),
  R("zakat", null, words("زكاة", "الزكاة", "זכאת", "zakat"), { gate: true }),
  R("mazoun", null, words("مأذون", "ماذون", "מאזון"), { gate: true }),
  R("umrah", "office=travel_agent|travel_agency|shop=travel_agency", UMRAH),
  R("umrah", null, UMRAH, { gate: true }),

  // ---- civic
  R("municipal", "amenity=townhall"),
  R(
    "municipal",
    null,
    words(
      "ביטוח לאומי",
      "national insurance",
      "التأمين الوطني",
      "משרד הפנים",
      "רשות האוכלוסין",
      "وزارة الداخلية",
      "לשכת התעסוקה",
      "שירות התעסוקה",
      "مكتب العمل",
      "לשכת רווחה",
      "מחלקת הרווחה",
      "الشؤون الاجتماعية",
    ),
    { gate: true, gateAmenity: true, first: true },
  ),
  R("municipal", "office=government&government=local_authority|municipality"),
  R(
    "municipal",
    "office=government",
    words(
      "עיריית",
      "עירייה",
      "מועצה",
      "בלדיה",
      "بلدية",
      "مجلس محلي",
      "مجلس إقليمي",
      "municipality",
      "council",
    ),
  ),
  R("post-offices", "amenity=post_office"),
  R("post-offices", "office=post"),
  R("libraries", "amenity=library"),
  R("emergency", "amenity=police|fire_station|ranger_station"),
  R("emergency", "emergency=ambulance_station|lifeguard_base|mountain_rescue"),
  R("emergency", "office=emergency"),
  R("public-clinics", "amenity=hospital", null, { also: ["emergency"] }),
  R("public-clinics", "healthcare=hospital", null, { also: ["emergency"] }),
  R("buses", "amenity=bus_station"),
  R("buses", "railway=station|halt"),
  R("buses", "public_transport=station"),
  R("parking", "amenity=parking|parking_entrance&!access=private|no|customers"),
  R("water", "office=water_utility|energy_supplier|utility"),
  R(
    "water",
    "office=government",
    words("תאגיד מים", "חברת החשמל", "מי ", "مياه", "شركة الكهرباء", "water corporation"),
  ),
  R(
    "permits",
    "office=government",
    words("ועדה לתכנון", "ועדה מקומית", "רישוי", "הנדסה", "لجنة التنظيم", "ترخيص", "planning"),
  ),
  R("municipal", "office=government", null, { fallback: true }),

  // ---- community
  R("scouts", "club=scout"),
  R(
    "scouts",
    null,
    words(
      "צופים",
      "צופי ",
      "كشاف",
      "كشافة",
      "scouts",
      "בני עקיבא",
      "השומר הצעיר",
      "הנוער העובד",
      "נוער לומד",
      "בני המושבים",
      "הצופים",
    ),
    { gateAmenity: true },
  ),
  R("senior-centres", "amenity=social_facility&social_facility:for=senior|elderly"),
  R("senior-centres", "amenity=nursing_home|retirement_home"),
  R("senior-centres", "social_facility=nursing_home|assisted_living"),
  R(
    "senior-centres",
    null,
    words(
      "בית אבות",
      "דיור מוגן",
      "מרכז יום",
      "גמלאים",
      "קשישים",
      "מועדון הוותיקים",
      "ותיקים",
      "دار المسنين",
      "دار مسنين",
      "مسنين",
      "senior",
      "elderly",
    ),
    { gateAmenity: true },
  ),
  R("youth-clubs", "amenity=youth_centre"),
  R(
    "youth-clubs",
    "amenity=community_centre|social_centre|social_facility",
    words("נוער", "شبيبة", "شباب", "youth", "teen"),
  ),
  R("community-centres", "amenity=community_centre|social_centre"),
  R("community-gardens", "leisure=garden&garden:type=community"),
  R(
    "community-gardens",
    "leisure=garden",
    words("גינה קהילתית", "גינת קהילה", "community garden", "حديقة مجتمعية"),
  ),
  R("charity-shops", "shop=charity|second_hand"),
  R("qard-hasan", null, words('גמ"ח', "גמח", "قرض حسن", "القرض الحسن", "free loan"), {
    gate: true,
  }),
  R("women-coop", null, words("קואופרטיב", "تعاونية", "cooperative", "co-op"), { gate: true }),
  R("volunteers", null, words("מתנדבים", "התנדבות", "تطوع", "متطوعين", "volunteer"), {
    gate: true,
  }),
  R("nonprofits", "office=ngo|association|charity|foundation|non_profit|religion", null, {
    fallback: true,
  }),
  R("nonprofits", "amenity=social_facility", null, { fallback: true }),
  R(
    "nonprofits",
    null,
    words("עמותת", "עמותה", "جمعية", "جمعيه", "association", "foundation", "קרן "),
    { gate: true },
  ),

  // ---- health
  R("pharmacies", "amenity=pharmacy"),
  R("pharmacies", "healthcare=pharmacy"),
  R("kids-dentists", "amenity=dentist|healthcare=dentist", KIDS),
  R("kids-dentists", "healthcare=dentist", KIDS),
  R("orthodontics", "healthcare:speciality~orthodontics"),
  R("orthodontics", "amenity=dentist", words("אורתודונט", "יישור שיניים", "orthodont", "تقويم")),
  R("dental", "amenity=dentist"),
  R("dental", "healthcare=dentist"),
  R(
    "vets",
    "amenity=veterinary",
    words("בקר", "צאן", "livestock", "large animal", "مواشي", "أبقار"),
    { kind: "livestock-vets" },
  ),
  R("vets", "amenity=veterinary"),
  R("vets", "healthcare=veterinary"),
  R("physio", "healthcare=physiotherapist"),
  R("physio", "healthcare:speciality~physiotherapy|rehabilitation"),
  R("speech-therapy", "healthcare=speech_therapist"),
  R("occupational-therapy", "healthcare=occupational_therapist"),
  R("nutrition", "healthcare=nutrition_counselling|dietitian"),
  R("therapy", "healthcare=psychotherapist|psychologist|counselling"),
  R("therapy", "healthcare:speciality~psychiatry|psychology|psychotherapy"),
  R("dermatology", "healthcare:speciality~dermatology"),
  R("pediatric", "healthcare:speciality~paediatrics|pediatrics"),
  R("optics", "shop=optician|hearing_aids"),
  R("optics", "healthcare=optometrist|audiologist"),
  R("optics", "craft=optician"),
  R("home-nursing", "healthcare=nurse|home_care"),
  R(
    "speech-therapy",
    null,
    words("קלינאית תקשורת", "קלינאי תקשורת", "תקשורת ושפה", "speech therap", "علاج نطق", "نطق"),
    { gate: true },
  ),
  R("occupational-therapy", null, words("ריפוי בעיסוק", "occupational therap", "علاج وظيفي"), {
    gate: true,
  }),
  R("physio", null, words("פיזיותרפ", "physiother", "physio", "علاج طبيعي", "فيزيوثيرابي"), {
    gate: true,
  }),
  R("nutrition", null, words("דיאטנ", "תזונ", "nutrition", "dietit", "تغذية"), { gate: true }),
  R(
    "therapy",
    null,
    words(
      "פסיכולוג",
      "פסיכותרפ",
      "psycholog",
      "psychother",
      "علاج نفسي",
      "أخصائي نفسي",
      "טיפול רגשי",
    ),
    { gate: true },
  ),
  R("dermatology", null, words("רופא עור", "dermatolog", "طبيب جلد", "أمراض جلدية"), {
    gate: true,
  }),
  R("pediatric", "amenity=doctors|clinic|healthcare=doctor|clinic", KIDS),
  R("hair-clinics", null, words("השתלת שיער", "hair transplant", "زراعة شعر", "נשירת שיער"), {
    gate: true,
  }),
  R("public-clinics", "amenity=clinic|doctors", null, { fallback: true }),
  R(
    "public-clinics",
    "healthcare=clinic|doctor|centre|laboratory|blood_donation|sample_collection",
    null,
    { fallback: true },
  ),
  R("home-nursing", null, words("סיעוד", "nursing", "تمريض", "رعاية منزلية"), { gate: true }),
  R("optics", "shop=*", words("אופטיק", "optic", "بصريات", "نظارات", "משקפ")),
  R("pharmacies", "shop=medical_supply|chemist", words("פארם", "pharm", "صيدلي", "מרקחת")),
  R("pharmacies", "shop=medical_supply"),
  R("cosmetics", "shop=chemist"),

  // ---- beauty
  R("barbershops", "shop=hairdresser&hairdresser=male|barber"),
  R("barbershops", "shop=barber"),
  R("barbershops", "shop=hairdresser", BARBER),
  R(
    "ladies-spa",
    "shop=beauty|massage|leisure=spa",
    words("לנשים", "נשים בלבד", "للسيدات", "نسائي", "ladies", "women only"),
  ),
  R(
    "ladies-spa",
    "leisure=spa|sauna",
    words("לנשים", "נשים בלבד", "للسيدات", "نسائي", "ladies", "women only"),
  ),
  R(
    "hair-clinics",
    "shop=hairdresser|beauty",
    words("השתלת שיער", "hair clinic", "زراعة شعر", "trichology"),
  ),
  R("salons", "shop=hairdresser"),
  R("nails", "shop=beauty&beauty~nails"),
  R("nails", "shop=nails"),
  R(
    "nails",
    "shop=beauty|cosmetics",
    words("ציפורנ", "מניקור", "פדיקור", "nail", "manicure", "أظافر", "اظافر", "مانيكير"),
  ),
  R("brows", "shop=beauty&beauty~eyebrow|eyelashes|lashes"),
  R("brows", "shop=beauty", words("גבות", "ריסים", "brow", "lash", "حواجب", "رموش")),
  R("aesthetic", "shop=beauty&beauty~laser|aesthetics|tanning"),
  R(
    "aesthetic",
    "shop=beauty",
    words("לייזר", "laser", "ليزر", "אסתטי", "aesthetic", "בוטוקס", "botox", "בוטקס"),
  ),
  R("sugaring", "shop=beauty&beauty~waxing|sugaring"),
  R(
    "sugaring",
    "shop=beauty",
    words("שעווה", "wax", "sugaring", "שוגרינג", "הסרת שיער", "إزالة شعر", "سكر$"),
  ),
  R("makeup", "shop=beauty&beauty~makeup|make_up"),
  R(
    "makeup",
    "shop=beauty",
    words("איפור", "מאפר", "makeup", "make up", "make-up", "مكياج", "ميك اب"),
  ),
  R("spas", "shop=beauty&beauty~spa|massage"),
  R("spas", "shop=massage"),
  R("spas", "leisure=spa|sauna"),
  R("spas", "amenity=spa|public_bath&!bath:type=mikveh"),
  R(
    "spas",
    "shop=beauty",
    words("ספא", "spa$", "עיסוי", "massage", "مساج", "سبا", "حمام تركي", "חמאם", "hammam"),
  ),
  R("facials", "shop=beauty"),
  R("perfume", "shop=perfumery"),
  R(
    "perfume",
    "shop=cosmetics",
    words("בשמים", "בושם", "perfume", "parfum", "عطور", "عطر", "بخور", "oud", "עוד$"),
  ),
  R("cosmetics", "shop=cosmetics|beauty_supply"),
  R(
    "salons",
    null,
    words("מספרה", "עיצוב שיער", "hair salon", "hair design", "صالون شعر", "تصفيف"),
    { gate: true },
  ),
  R("barbershops", null, words("barber", "حلاق", "ברבר"), { gate: true }),
  R("nails", null, words("ציפורנ", "מניקור", "nail", "أظافر"), { gate: true }),
  R("spas", null, words("ספא", "spa$", "עיסוי", "massage", "مساج"), { gate: true }),

  // ---- sports
  R("yoga", "sport~yoga|pilates"),
  R(
    "yoga",
    "leisure=fitness_centre|sports_centre|amenity=studio",
    words("יוגה", "פילאטיס", "yoga", "pilates", "يوغا", "بيلاتس"),
  ),
  R("yoga", null, words("יוגה", "פילאטיס", "yoga", "pilates", "يوغا", "بيلاتس"), { gate: true }),
  R(
    "martial-arts",
    "sport~martial_arts|karate|judo|taekwondo|boxing|kickboxing|aikido|krav_maga|mma|jiu-jitsu|wrestling|kung_fu",
  ),
  R("martial-arts", "leisure=dojo"),
  R(
    "martial-arts",
    null,
    words(
      "קראטה",
      "ג'ודו",
      "גודו",
      "טאקוונדו",
      "אגרוף",
      "קרב מגע",
      "קיקבוקס",
      "karate",
      "judo",
      "taekwondo",
      "boxing",
      "kickbox",
      "krav maga",
      "كاراتيه",
      "جودو",
      "تايكوندو",
      "ملاكمة",
      "dojo",
    ),
    { gate: true, gateAmenity: true },
  ),
  R("aquatic-centres", "leisure=water_park"),
  R("aquatic-centres", "leisure=swimming_pool|sports_centre&sport~swimming&!access=private|no"),
  R(
    "aquatic-centres",
    "leisure=swimming_pool&!access=private|no|customers",
    words("בריכ", "pool", "بركة", "مسبح", "קאנטרי", "country"),
  ),
  R("padel", "sport~padel|tennis&leisure=sports_centre|pitch|club"),
  R("padel", "club=sport&sport~padel|tennis"),
  R(
    "padel",
    null,
    words(
      "פאדל",
      "padel",
      "בית הטניס",
      "מרכז הטניס",
      "tennis center",
      "tennis centre",
      "بادل",
      "تنس",
    ),
    { gate: true, gateAmenity: true },
  ),
  R(
    "football-academies",
    null,
    words(
      "בית ספר לכדורגל",
      "אקדמיה לכדורגל",
      "אקדמיית כדורגל",
      "football academy",
      "soccer school",
      "soccer academy",
      "أكاديمية كرة",
      "اكاديمية كرة",
      "مدرسة كرة",
    ),
    { gate: true, gateAmenity: true },
  ),
  R(
    "swimming",
    null,
    words(
      "בית ספר לשחייה",
      "שיעורי שחייה",
      "swim school",
      "swimming school",
      "مدرسة سباحة",
      "تعليم سباحة",
    ),
    { gate: true, gateAmenity: true },
  ),
  R("gyms", "leisure=fitness_centre"),
  R("gyms", "amenity=gym"),
  R("gyms", "sport~fitness|bodybuilding|crossfit"),
  R(
    "gyms",
    null,
    words(
      "חדר כושר",
      "מכון כושר",
      "gym$",
      "fitness",
      "crossfit",
      "جيم",
      "نادي لياقة",
      "קרוספיט",
      "סטודיו לכושר",
    ),
    { gate: true, gateAmenity: true },
  ),
  R(
    "trainers",
    null,
    words("מאמן אישי", "מאמנת אישית", "אימון אישי", "personal trainer", "مدرب شخصي"),
    { gate: true },
  ),
  R(
    "running-clubs",
    null,
    words("קבוצת ריצה", "מועדון ריצה", "running club", "run club", "نادي ركض"),
    { gate: true, gateAmenity: true },
  ),
  R("stables", "leisure=horse_riding"),
  R("stables", "sport~equestrian"),
  R("sports-clubs", "club=sport"),
  R(
    "sports-clubs",
    "leisure=sports_centre|stadium|sports_hall|ice_rink|bowling_alley|climbing|golf_course",
  ),
  R(
    "sports-clubs",
    "leisure=pitch|track",
    words(
      "מועדון",
      "club",
      "نادي",
      "הפועל",
      "מכבי",
      'בית"ר',
      "בני ",
      "אליצור",
      "أكاديمية",
      "academy",
      "אקדמי",
    ),
  ),
  R("sportswear", "shop=sports|outdoor_sports|golf|scuba_diving|ski"),
  R("bikes", "shop=bicycle"),
  R("bikes", "amenity=bicycle_rental&!network=*"),
  R("fishing", "shop=fishing"),
  R("fishing", "shop=*", words("דיג$", "fishing", "صيد السمك", "معدات صيد")),

  // ---- kids
  R("daycare", "amenity=childcare"),
  R(
    "daycare",
    "amenity=kindergarten",
    words("מעון", "פעוטון", "daycare", "nursery", "حضانة", "תינוקייה", "משפחתון"),
  ),
  R("kindergartens", "amenity=kindergarten"),
  R("daycare", null, words("מעון יום", "פעוטון", "daycare", "حضانة"), {
    gate: true,
    gateAmenity: true,
  }),
  R("kindergartens", null, words("צהרון", "גן ילדים", "after school", "روضة"), { gate: true }),
  R("baby-shops", "shop=baby_goods"),
  R("baby-shops", "shop=*", words("תינוק", "בייבי", "baby", "بيبي", "رضع", "מוצצים")),
  R("kids-clothing", "shop=clothes&clothes~children|babies|kids"),
  R("kids-clothing", "shop=clothes|shoes", KIDS),
  R("toys", "shop=toys|games|hobby|model"),
  R("toys", "shop=*", words("צעצוע", "toys", "toy$", "ألعاب", "العاب")),
  R("kids-venues", "leisure=indoor_play|trampoline_park|amusement_arcade|miniature_golf"),
  R("kids-venues", "tourism=theme_park|zoo"),
  R(
    "kids-venues",
    null,
    words(
      "ג'ימבורי",
      "גימבורי",
      "משחקייה",
      "משחקיה",
      "playland",
      "play center",
      "play centre",
      "jimbory",
      "ג'מבורי",
      "פינת ליטוף",
      "trampoline",
      "טרמפולינ",
      "ملاهي",
      "العاب أطفال",
      "لونا بارك",
      "לונה פארק",
      "luna park",
    ),
    { gate: true, gateAmenity: true },
  ),

  // ---- education
  R("islamic-schools", "amenity=school|college&religion=muslim"),
  R("islamic-schools", "amenity=school|college", ISLAMIC),
  R("driving", "amenity=driving_school"),
  R(
    "driving",
    "shop=*|office=*",
    words(
      "בית ספר לנהיגה",
      'בי"ס לנהיגה',
      "לימוד נהיגה",
      "מורה נהיגה",
      "driving school",
      "مدرسة سياقة",
      "تعليم سياقة",
      "סיאקה",
    ),
  ),
  R(
    "driving",
    null,
    words("בית ספר לנהיגה", "לימוד נהיגה", "driving school", "مدرسة سياقة", "سياقة"),
    { gate: true, gateAmenity: true },
  ),
  R("language-schools", "amenity=language_school"),
  R(
    "language-schools",
    null,
    words(
      "אולפן",
      "ulpan",
      "language school",
      "לימוד שפות",
      "مدرسة لغات",
      "تعليم لغات",
      "berlitz",
      "וול סטריט",
      "wall street english",
    ),
    { gate: true, gateAmenity: true },
  ),
  R("art-schools", "amenity=music_school|dancing_school|art_school"),
  R("art-schools", "leisure=dance"),
  R("art-schools", "amenity=arts_centre"),
  R(
    "art-schools",
    null,
    words(
      "קונסרבטוריון",
      "conservator",
      "בית ספר למוזיקה",
      "music school",
      "סטודיו למחול",
      "בית ספר למחול",
      "dance studio",
      "מחול",
      "ballet",
      "בלט",
      "معهد موسيقى",
      "استوديو رقص",
      "רקוד",
      "סדנת אמנות",
      "חוג ציור",
    ),
    { gate: true, gateAmenity: true },
  ),
  R(
    "coding",
    null,
    words("רובוטיקה", "תכנות", "robotics", "coding", "برمجة", "روبوت", "מדעים לילדים"),
    { gate: true, gateAmenity: true },
  ),
  R(
    "psychometric",
    null,
    words("פסיכומטרי", "psychometric", "بسيخومتري", "مكينا", "מכינה קדם", "ממרכז ההכנה"),
    { gate: true, gateAmenity: true },
  ),
  R("tutors", "amenity=prep_school|tutoring"),
  R(
    "tutors",
    null,
    words(
      "שיעורי עזר",
      "מרכז למידה",
      "tutoring",
      "tutor",
      "دروس خصوصية",
      "دروس تقوية",
      "مركز تعليمي",
    ),
    { gate: true, gateAmenity: true },
  ),
  R(
    "cooking-schools",
    null,
    words(
      "סדנאות בישול",
      "סדנת בישול",
      "בית ספר לבישול",
      "בית ספר לקונדיטוריה",
      "cooking school",
      "cooking class",
      "مدرسة طبخ",
      "دورات طبخ",
    ),
    { gate: true, gateAmenity: true },
  ),
  R("sewing", "shop=sewing|fabric|haberdashery|wool"),
  R("vocational", "amenity=college|university"),
  R("vocational", "office=educational_institution"),
  R("courses", "amenity=training"),
  R(
    "courses",
    null,
    words(
      "הדרכה",
      "קורסים",
      "מכללת",
      "academy$",
      "training center",
      "training centre",
      "دورات",
      "تدريب",
      "قسم التدريب",
    ),
    { gate: true },
  ),

  // ---- tech
  R("coworking", "amenity=coworking_space"),
  R("coworking", "office=coworking"),
  R(
    "coworking",
    null,
    words("coworking", "co-working", "חלל עבודה", "חללי עבודה", "WeWork", "מתחם עבודה משותף"),
    { gate: true, gateAmenity: true },
  ),
  R("cybersecurity", null, words("סייבר", "cyber", "سايبر"), { gate: true }),
  R("game-studios", null, words("game studio", "games studio", "פיתוח משחקים", "studios games"), {
    gate: true,
  }),
  R("app-developers", null, words("אפליקציות", "apps$", "app development", "تطبيقات"), {
    gate: true,
  }),
  R(
    "ai-consulting",
    null,
    words("בינה מלאכותית", "artificial intelligence", "data science", "ذكاء اصطناعي", "AI$"),
    { gate: true },
  ),
  R("marketing-agencies", "office=advertising_agency|marketing"),
  R(
    "marketing-agencies",
    null,
    words(
      "פרסום",
      "שיווק",
      "marketing",
      "advertising",
      "إعلانات",
      "اعلانات",
      "تسويق",
      "מיתוג",
      "branding",
    ),
    { gate: true },
  ),
  R(
    "software-studios",
    "office=it|software|telecommunication&!shop=*",
    words("תוכנה", "software", "برمجيات", "פיתוח"),
  ),
  R(
    "saas",
    "office=company|research",
    words(
      "technolog",
      "טכנולוג",
      "tech$",
      "systems",
      "מערכות",
      "סמיקונד",
      "semiconductor",
      "labs$",
      "bio",
      "ביו",
      "חדשנות",
      "innovation",
    ),
  ),
  R("software-studios", "office=it|software"),
  R("it-support", "office=telecommunication"),
  R(
    "software-studios",
    null,
    words(
      "תוכנה",
      "software",
      "برمجيات",
      "פיתוח אתרים",
      "בניית אתרים",
      "web development",
      "تصميم مواقع",
    ),
    { gate: true },
  ),
  R("it-support", "craft=computer"),
  R("it-support", "shop=computer", null, { also: ["electronics"] }),
  R(
    "it-support",
    null,
    words(
      "טכנאי מחשבים",
      "מחשבים",
      "computers",
      "computer",
      "كمبيوتر",
      "حاسوب",
      "רשתות תקשורת",
      "networking",
    ),
    { gate: true },
  ),

  // ---- services
  R("lawyers", "office=lawyer|notary|legal"),
  R(
    "lawyers",
    null,
    words(
      'עו"ד',
      "עו״ד",
      "עורך דין",
      "עורכי דין",
      "עורכת דין",
      "lawyer",
      "law office",
      "law firm",
      "attorney",
      "advocate",
      "محامي",
      "محاماة",
      "نوטריון",
      "نوتريون",
      "נוטריון",
      "notary",
    ),
    { gate: true },
  ),
  R("accountants", "office=accountant|tax_advisor|financial|financial_advisor"),
  R(
    "accountants",
    null,
    words(
      'רו"ח',
      "רואה חשבון",
      "רואי חשבון",
      "הנהלת חשבונות",
      "יועץ מס",
      "יועצי מס",
      "accountant",
      "accounting",
      "cpa$",
      "محاسب",
      "محاسبة",
      "مستشار ضرائب",
    ),
    { gate: true },
  ),
  R("insurance", "office=insurance"),
  R("insurance", null, words("ביטוח", "ביטוחים", "insurance", "تأمين", "تامين"), { gate: true }),
  R("real-estate", "office=estate_agent|real_estate|property_management"),
  R("real-estate", "shop=estate_agent"),
  R(
    "real-estate",
    null,
    words(
      'נדל"ן',
      "נדלן",
      "תיווך",
      "real estate",
      "realty",
      "عقارات",
      "remax",
      "רי/מקס",
      "רימקס",
      "אנגלו סכסון",
      "anglo saxon",
    ),
    { gate: true },
  ),
  R("movers", "office=moving_company"),
  R("movers", null, words("הובלות", "הובלה", "movers", "moving", "نقليات", "نقل عفش"), {
    gate: true,
  }),
  R("cleaning", "craft=cleaning|office=cleaning"),
  R("cleaning", null, words("ניקיון", "ניקוי ", "cleaning", "تنظيف", "خدمات نظافة"), {
    gate: true,
  }),
  R("tailoring", "shop=dry_cleaning|laundry|tailor"),
  R("tailoring", "amenity=laundry"),
  R("tailoring", "craft=tailor|dressmaker|sewing"),
  R(
    "tailoring",
    null,
    words(
      "ניקוי יבש",
      "מכבסה",
      "מכבסת",
      "חייט",
      "תופרת",
      "תיקוני תפירה",
      "tailor",
      "laundry",
      "dry clean",
      "خياط",
      "مصبغة",
      "مكوى",
      "دراي كلين",
    ),
    { gate: true },
  ),
  R("glass-aluminium", "craft=glaziery|window_construction|aluminium"),
  R("glass-aluminium", "shop=glaziery|windows"),
  R(
    "glass-aluminium",
    null,
    words(
      "אלומיניום",
      "זגג",
      "aluminium",
      "aluminum",
      "ألمنيوم",
      "المنيوم",
      "زجاج",
      "glass",
      "תריסים",
      "shutters",
    ),
    { gate: true },
  ),
  R("device-repair", "craft=electronics_repair|mobile_phone_repair|computer_repair"),
  R("device-repair", "shop=repair|mobile_phone_repair|electronics_repair|computer_repair"),
  R(
    "device-repair",
    "shop=mobile_phone|electronics|computer",
    words("תיקון", "תיקונים", "מעבדה", "מעבדת", "repair", "fix", "lab$", "تصليح", "صيانة"),
  ),
  R(
    "device-repair",
    null,
    words(
      "מעבדת סלולר",
      "תיקון טלפונים",
      "תיקון מחשבים",
      "phone repair",
      "תיקון סלולר",
      "تصليح خلوي",
      "تصليح جوالات",
    ),
    { gate: true },
  ),
  R(
    "technicians",
    "craft=electrician|plumber|hvac|air_conditioning|heating_engineer|gas_installer|insulation",
  ),
  R("technicians", "shop=electrical|air_conditioning|gas"),
  R(
    "technicians",
    null,
    words(
      "חשמלאי",
      "אינסטלטור",
      "אינסטלציה",
      "מיזוג אוויר",
      "מזגנים",
      "electrician",
      "plumber",
      "plumbing",
      "air condition",
      "hvac",
      "كهربائي",
      "سباك",
      "سباكة",
      "تكييف",
      "مكيفات",
      "דודי שמש",
    ),
    { gate: true },
  ),
  R(
    "contractors",
    "craft=builder|construction|roofer|tiler|stonemason|plasterer|floorer|parquet_layer|scaffolder|insulation",
  ),
  R("contractors", "office=construction_company|construction|contractor"),
  R(
    "contractors",
    "shop=doityourself|hardware|trade|building_materials|tiles|flooring|bathroom_furnishing|plumbing|ceramics",
  ),
  R(
    "contractors",
    null,
    words(
      "קבלן",
      "קבלני",
      "שיפוצים",
      "שיפוץ",
      "בנייה",
      "בניה",
      "חומרי בניין",
      "contractor",
      "renovation",
      "construction",
      "مقاول",
      "مقاولات",
      "ترميم",
      "مواد بناء",
      "بناء",
    ),
    { gate: true },
  ),

  // ---- home
  R("architects", "office=architect|interior_design|engineer|surveyor"),
  R("architects", "craft=interior_decorator"),
  R(
    "architects",
    null,
    words(
      "אדריכל",
      "עיצוב פנים",
      "architect",
      "interior design",
      "مهندس معماري",
      "هندسة معمارية",
      "تصميم داخلي",
      "מהנדס",
      "הנדסה אזרחית",
      "engineering",
    ),
    { gate: true },
  ),
  R("kitchens", "shop=kitchen"),
  R("kitchens", null, words("מטבחים", "מטבחי", "kitchens", "kitchen", "مطابخ", "مطبخ"), {
    gate: true,
  }),
  R("curtains", "shop=curtain|window_blind"),
  R("curtains", null, words("וילונות", "וילון", "curtain", "blinds", "برادي", "ستائر", "ستاير"), {
    gate: true,
  }),
  R("furniture", "shop=furniture|bed|mattress|garden_furniture"),
  R(
    "furniture",
    null,
    words("רהיטים", "רהיט", "furniture", "أثاث", "اثاث", "מזרנים", "mattress", "סלון "),
    { gate: true },
  ),
  R(
    "solar",
    null,
    words("סולאר", "solar", "שמש", "שמשי", "طاقة شمسية", "سولار", "פאנלים", "photovoltaic"),
    { gate: true },
  ),
  R("pools", "shop=swimming_pool"),
  R("pools", null, words("בריכות", "pool service", "pool supplies", "صيانة برك"), { gate: true }),
  R("gardeners", "craft=gardener|landscaper"),
  R("gardeners", "office=landscape_architect"),
  R(
    "gardeners",
    null,
    words("גינון", "גנן", "עיצוב נוף", "gardening", "landscap", "تنسيق حدائق", "حدائق"),
    { gate: true },
  ),
  R("locksmiths", "shop=locksmith|key_cutter"),
  R("locksmiths", "craft=locksmith|key_cutter"),
  R("locksmiths", null, words("מנעולן", "מנעולים", "locksmith", "keys", "مفاتيح", "أقفال"), {
    gate: true,
  }),
  R("pest-control", "craft=pest_control"),
  R(
    "pest-control",
    null,
    words("הדברה", "מדביר", "pest", "مبيدات", "إبادة حشرات", "مكافحة حشرات"),
    { gate: true },
  ),
  R("painters", "shop=paint"),
  R("painters", "craft=painter|decorator"),
  R(
    "painters",
    null,
    words("צבעים", "צבעי", "צבע$", "painter", "paint$", "paints", "دهان", "دهانات", "طرش"),
    { gate: true },
  ),
  R("upholstery", "craft=upholsterer"),
  R("upholstery", null, words("רפד", "ריפוד", "upholster", "تنجيد", "منجد"), { gate: true }),
  R("decor", "shop=interior_decoration|lighting|carpet|frame|antiques"),
  R(
    "decor",
    null,
    words(
      "עיצוב הבית",
      "home decor",
      "decor",
      "ديكور",
      "ديكورات",
      "תאורה",
      "lighting",
      "שטיחים",
      "carpet",
      "سجاد",
    ),
    { gate: true },
  ),
  R("kitchenware", "shop=houseware|kitchenware|kitchen_equipment"),
  R(
    "kitchenware",
    null,
    words(
      "כלי בית",
      "כלי מטבח",
      "houseware",
      "kitchenware",
      "أدوات منزلية",
      "ادوات منزلية",
      "أواني",
    ),
    { gate: true },
  ),

  // ---- industry
  R("sign-makers", "craft=signmaker"),
  R("sign-makers", "shop=signs"),
  R("sign-makers", null, words("שלטים", "שילוט", "signs", "signage", "يافطات", "لافتات", "آرمات"), {
    gate: true,
  }),
  R("metalworks", "craft=metal_construction|blacksmith|welder|metal_works|metalworker"),
  R(
    "metalworks",
    null,
    words(
      "מסגריה",
      "מסגרייה",
      "מסגרות",
      "מסגר$",
      "metal",
      "welding",
      "steel",
      "حدادة",
      "حداد",
      "פלדה",
      "ברזל",
    ),
    { gate: true },
  ),
  R("carpentry", "craft=carpenter|joiner|cabinet_maker|woodworker|sawmill"),
  R(
    "carpentry",
    null,
    words(
      "נגריה",
      "נגרייה",
      "נגר$",
      "נגרות",
      "carpent",
      "joinery",
      "woodwork",
      "نجارة",
      "نجار",
      "منجرة",
    ),
    { gate: true },
  ),
  R("packaging", "industrial=packaging"),
  R("packaging", null, words("אריזות", "אריזה", "packaging", "تغليف", "كرتون"), { gate: true }),
  R("couriers", "office=courier|logistics|delivery"),
  R("couriers", "amenity=post_depot"),
  R("couriers", "shop=courier"),
  R(
    "couriers",
    null,
    words(
      "שליחויות",
      "שליחים",
      "לוגיסטיקה",
      "לוגיסטי",
      "courier",
      "logistic",
      "shipping",
      "express",
      "DHL",
      "UPS$",
      "FedEx",
      "شحن",
      "توصيل طرود",
      "لوجستي",
    ),
    { gate: true },
  ),
  R("warehouses", "industrial=warehouse|storage|depot"),
  R("warehouses", "shop=storage_rental"),
  R("warehouses", null, words("מחסני", "מחסן", "storage", "warehouse", "مخازن", "مخزن"), {
    gate: true,
  }),
  R("recruiting", "office=employment_agency|recruitment"),
  R(
    "recruiting",
    null,
    words("כוח אדם", "כח אדם", "השמה", "recruit", "staffing", "manpower", "توظيف", "قوى عاملة"),
    { gate: true },
  ),
  R("security", "office=security|guard"),
  R("security", null, words("אבטחה", "שמירה", "security", "حراسة", "أمن$", "מיגון"), {
    gate: true,
  }),
  R("wholesalers", "shop=wholesale"),
  R("wholesalers", "office=distributor|wholesale"),
  R(
    "wholesalers",
    null,
    words(
      "סיטונא",
      "סיטונאות",
      "wholesale",
      "distribut",
      "הפצה",
      "שיווק והפצה",
      "جملة",
      "بالجملة",
      "توزيع",
    ),
    { gate: true },
  ),
  R("factories", "man_made=works"),
  R(
    "factories",
    "industrial=*&!industrial=warehouse|storage|depot|port|shipyard|scrap_yard|mine|oil|gas|well|wellsite|distributor",
  ),
  R(
    "factories",
    "office=company",
    words(
      "מפעל",
      "מפעלי",
      "תעשיות",
      "industries",
      "factory",
      "manufactur",
      "مصنع",
      "مصانع",
      "صناعات",
    ),
  ),
  R("factories", "craft=*", words("מפעל", "תעשיות", "industries", "factory", "مصنع")),

  // ---- auto
  R("dealers", "shop=car"),
  R(
    "dealers",
    null,
    words(
      "מגרש רכב",
      "סוכנות רכב",
      "car dealer",
      "used cars",
      "معرض سيارات",
      "سيارات مستعملة",
      "מכירת רכבים",
    ),
    { gate: true },
  ),
  R("car-rental", "amenity=car_rental|car_sharing&!network=*"),
  R("car-rental", "shop=car_rental|office=car_rental"),
  R(
    "car-rental",
    null,
    words(
      "השכרת רכב",
      "rent a car",
      "rent-a-car",
      "car rental",
      "تأجير سيارات",
      "השכרת רכבים",
      "ליסינג",
      "leasing",
    ),
    { gate: true },
  ),
  R("car-wash", "amenity=car_wash"),
  R(
    "car-wash",
    null,
    words(
      "שטיפת רכב",
      "שטיפה",
      "car wash",
      "carwash",
      "غسيل سيارات",
      "مغسلة سيارات",
      "ديتيلينج",
      "detailing",
    ),
    { gate: true },
  ),
  R("motorcycles", "shop=motorcycle|motorcycle_repair|scooter"),
  R(
    "motorcycles",
    null,
    words(
      "אופנועים",
      "אופנוע",
      "קטנוע",
      "motorcycle",
      "motorbike",
      "scooter",
      "دراجات نارية",
      "موتورات",
      "ماتورات",
    ),
    { gate: true },
  ),
  R("taxis", "amenity=taxi"),
  R("taxis", "office=taxi"),
  R("taxis", null, words("מוניות", "מונית", "taxi", "تكسي", "تاكسي", "سفريات"), { gate: true }),
  R("auto-parts", "shop=car_parts|auto_parts|car_accessories|truck_parts"),
  R(
    "auto-parts",
    null,
    words(
      "חלקי חילוף",
      "חלפים",
      "אביזרי רכב",
      "auto parts",
      "car parts",
      "spare parts",
      "قطع غيار",
      "اكسسوارات سيارات",
    ),
    { gate: true },
  ),
  R("towing", "shop=towing|office=towing"),
  R(
    "towing",
    null,
    words("גרר", "גרירה", "towing", "tow truck", "ونش", "سحب سيارات", "חילוץ רכב"),
    { gate: true },
  ),

  // ---- agriculture
  R("plant-shops", "shop=garden_centre|plant_nursery", null, { also: ["seedlings"] }),
  R("plant-shops", "landuse=plant_nursery"),
  R("seedlings", "shop=seeds|seed"),
  R("seedlings", null, words("שתילים", "שתלנות", "seedlings", "أشتال", "اشتال", "بذور"), {
    gate: true,
  }),
  R(
    "plant-shops",
    null,
    words("משתלה", "משתלת", "משתלות", "nursery", "garden center", "garden centre", "مشتل"),
    { gate: true },
  ),
  R("beekeepers", "craft=beekeeper"),
  R("beekeepers", "shop=honey"),
  R("beekeepers", null, words("דבש", "מכוורת", "honey", "apiary", "عسل", "مناحل", "منحل"), {
    gate: true,
  }),
  R("olive-press", "craft=oil_mill|olive_press"),
  R("olive-press", "man_made=works&product~olive_oil|oil"),
  R(
    "olive-press",
    null,
    words(
      "בית בד",
      "בית הבד",
      "olive press",
      "olive mill",
      "olive oil",
      "olive factory",
      "squeez",
      "presser",
      "معصرة",
      "معاصر",
      "زيت زيتون",
      "שמן זית",
      "מעצרה",
      "מעסרה",
    ),
    // Olive presses are mapped as works, shops or halls: the name says what they are.
    { gate: true, gateAmenity: true, gateTourism: true, first: true, gateAll: true },
  ),
  R("dairy", "shop=dairy|cheese"),
  R(
    "dairy",
    null,
    words("מחלבה", "מחלבת", "dairy", "creamery", "ألبان", "البان", "מחלבות", "גבינות", "cheese"),
    { gate: true },
  ),
  R("egg-farms", null, words("ביצים", "ביצי חופש", "eggs", "egg farm", "بيض"), { gate: true }),
  R("farm-shops", "shop=farm|greengrocer"),
  R(
    "farm-shops",
    null,
    words(
      "פירות וירקות",
      "ירקות ופירות",
      "ירקן",
      "משק ",
      "חוות ",
      "greengrocer",
      "farm shop",
      "خضار",
      "خضرة",
      "فواكه",
      "خضراوات",
    ),
    { gate: true },
  ),
  R("farmers-markets", "amenity=marketplace"),
  R(
    "farmers-markets",
    null,
    words("שוק איכרים", "farmers market", "farmers' market", "سوق الفلاحين"),
    { gate: true, gateAmenity: true },
  ),
  R(
    "tractors",
    "shop=agrarian|tractor|agricultural_machinery",
    words("השקיה", "irrigation", "ري$", "نتافيم", "נטפים", "netafim"),
    { kind: "irrigation" },
  ),
  R("tractors", "shop=agrarian|tractor|agricultural_machinery|agricultural|farm_equipment"),
  R(
    "tractors",
    null,
    words(
      "טרקטור",
      "ציוד חקלאי",
      "מיכון חקלאי",
      "tractor",
      "farm equipment",
      "جرارات",
      "تراكتور",
      "معدات زراعية",
    ),
    { gate: true },
  ),
  R("irrigation", null, words("השקיה", "irrigation", "نتافيم", "أنظمة ري", "انظمة ري"), {
    gate: true,
  }),
  R(
    "stables",
    null,
    words(
      "חוות סוסים",
      "רכיבה על סוסים",
      "רכיבה טיפולית",
      "horse riding",
      "horseback",
      "equestrian",
      "חוות רכיבה",
      "اسطبل",
      "إسطبل",
      "فروسية",
      "خيول",
    ),
    { gate: true, gateAmenity: true },
  ),
  R(
    "farm-stays",
    "tourism=guest_house|chalet|apartment",
    words("חווה", "חוות", "משק", "farm", "ranch", "مزرعة"),
  ),

  // ---- events
  R("venues", "amenity=events_venue|conference_centre|exhibition_centre|wedding_hall"),
  // A wedding hall is often mapped as an attraction or a council building: its name says it.
  R(
    "venues",
    null,
    words(
      "ללאפראח",
      "للأفراح",
      "للافراح",
      "أفراح",
      "افراح",
      "אולם אירועים",
      "אולמי אירועים",
      "גן אירועים",
      "wedding hall",
      "event hall",
      "events hall",
      "قاعة أفراح",
      "قاعة افراح",
    ),
    { gate: true, gateAll: true, first: true },
  ),
  R(
    "venues",
    null,
    words(
      "אולם אירועים",
      "אולמי",
      "אולם ",
      "גן אירועים",
      "גני אירועים",
      "event hall",
      "events hall",
      "wedding hall",
      "banquet",
      "قاعة",
      "قاعات",
      "قصر أفراح",
      "حديقة أفراح",
      "מתחם אירועים",
      "event garden",
      "גני אירוע",
    ),
    { gate: true, gateAmenity: true },
  ),
  R("planners", "office=event_management|event_planner"),
  R(
    "planners",
    null,
    words(
      "הפקות",
      "הפקת אירועים",
      "event planner",
      "event management",
      "wedding planner",
      "تنظيم مناسبات",
      "تنظيم حفلات",
      "إنتاج",
    ),
    { gate: true },
  ),
  R("henna", null, words("חינה", "henna", "حناء", "حنة", "حنا$"), { gate: true }),
  R("florists", "shop=florist"),
  R("florists", null, words("פרחים", "פרחי", "florist", "flowers", "زهور", "ورود", "ورد$"), {
    gate: true,
  }),
  R("bridal-rental", "shop=bridal|wedding"),
  R("bridal-rental", "shop=clothes&clothes~wedding|bridal"),
  R("bridal-rental", "shop=clothes|fashion|boutique|rental", BRIDAL),
  R("bridal-rental", null, BRIDAL, { gate: true }),
  R("photographers", "craft=photographer|photo_studio"),
  R("photographers", "shop=photo|photo_studio|camera"),
  R("photographers", "amenity=studio&studio~photography|video"),
  R(
    "photographers",
    null,
    words("צלם", "צילום", "photograph", "photo$", "studio photo", "تصوير", "مصور", "فوتو"),
    { gate: true },
  ),
  R("printing", "shop=copyshop|printing|printer"),
  R("printing", "craft=printer|bookbinder|print_shop"),
  R(
    "printing",
    null,
    words("דפוס", "הדפסות", "הדפסה", "printing", "print$", "prints", "مطبعة", "طباعة", "مطابع"),
    { gate: true },
  ),
  R("escape-rooms", "leisure=escape_game"),
  R(
    "escape-rooms",
    null,
    words("חדר בריחה", "חדרי בריחה", "escape room", "escape game", "غرفة هروب", "אסקייפ"),
    { gate: true, gateAmenity: true },
  ),
  R(
    "tents",
    null,
    words(
      "השכרת אוהלים",
      "השכרת ציוד לאירועים",
      "השכרת כיסאות",
      "אוהלים",
      "tent rental",
      "tents",
      "خيام",
      "تأجير كراسي",
    ),
    { gate: true },
  ),
  R("event-decor", "shop=party|balloons"),
  R(
    "event-decor",
    null,
    words("בלונים", "balloons", "עיצוב אירועים", "party decor", "زينة", "بالونات", "ديكور مناسبات"),
    { gate: true },
  ),
  R("favours", null, words("מזכרות", "favours", "favors", "توزيعات"), { gate: true }),

  // ---- travel
  R(
    "hotels",
    "tourism=hotel|motel|guest_house|hostel|apartment|chalet|alpine_hut|wilderness_hut&!access=private",
  ),
  R(
    "hotels",
    null,
    words(
      "צימר",
      "zimmer",
      "מלון",
      "hotel",
      "אכסני",
      "hostel",
      "guest house",
      "guesthouse",
      "فندق",
      "بيت ضيافة",
      "نزل",
      "ספא בוטיק",
      "בקתות",
      "cabins",
    ),
    { gate: true, gateTourism: true },
  ),
  R("camping", "tourism=camp_site|caravan_site"),
  R("camping", "shop=outdoor|camping"),
  R(
    "camping",
    null,
    words("קמפינג", "חניון לילה", "camping", "glamping", "תיירות שטח", "تخييم", "كامبينج"),
    { gate: true, gateTourism: true },
  ),
  R("tours", "office=guide"),
  R("tours", "tourism=museum|aquarium"),
  R("tours", "tourism=information&information=office"),
  R("tours", "tourism=attraction", null, { attraction: true }),
  R("tours", null, words("סיורים", "סיורי", "tours", "tour$", "جولات", "سياحة"), { gate: true }),
  R("travel-agencies", "shop=travel_agency|travel_agent"),
  R("travel-agencies", "office=travel_agent|travel_agency|tour_operator"),
  R(
    "travel-agencies",
    null,
    words("נסיעות", "תיירות", "travel", "טיסות", "flights", "سفريات", "سياحة وسفر", "طيران"),
    { gate: true },
  ),
  R("tour-buses", "office=bus|transport|coach", null),
  R(
    "tour-buses",
    null,
    words("הסעות", "אוטובוסים", "coach", "bus rental", "باصات", "حافلات", "تأجير باصات"),
    { gate: true },
  ),
  R("currency-exchange", "amenity=bureau_de_change|money_transfer"),
  R("currency-exchange", "shop=money_lender|money_transfer"),
  R(
    "currency-exchange",
    null,
    words(
      "צ'יינג'",
      "צ׳יינג׳",
      "צינג'",
      "המרת מטבע",
      "שירותי מטבע",
      "change$",
      "exchange",
      "صرافة",
      "صراف",
      "تحويل أموال",
      "western union",
      "וסטרן יוניון",
    ),
    { gate: true },
  ),
  R("visas", "office=translation|translator"),
  R(
    "visas",
    null,
    words("תרגום", "תרגומים", "translation", "ويزا", "ترجمة", "ויזה", "visa", "דרכונים"),
    { gate: true },
  ),
  R(
    "study-abroad",
    null,
    words('לימודים בחו"ל', "study abroad", "الدراسة في الخارج", "دراسة بالخارج"),
    { gate: true },
  ),
  R("luggage", "shop=bag|luggage|leather"),
  R("luggage", null, words("מזוודות", "תיקים", "luggage", "suitcase", "bags", "شنط", "حقائب"), {
    gate: true,
  }),

  // ---- retail
  R(
    "sportswear",
    "shop=shoes|clothes",
    words(
      "ספורט",
      "sport",
      "רנר",
      "runner",
      "nike",
      "adidas",
      "puma",
      "rebook",
      "רבוק",
      "under armour",
      "decathlon",
      "דקטלון",
      "رياضة",
      "رياضي",
    ),
  ),
  R(
    "fashion",
    "shop=clothes|shoes|boutique|fashion|fashion_accessories|hat|underwear|lingerie|tailor_shop|uniform",
  ),
  R("gold", "shop=jewelry|jewellery|gold_buyer|precious_metals"),
  R("gold", "craft=jeweller|goldsmith"),
  R("gold", null, words("תכשיטים", "תכשיט", "זהב", "jewel", "gold", "ذهب", "مجوهرات", "صياغة"), {
    gate: true,
  }),
  R("watches", "shop=watches|clock"),
  R("watches", "craft=watchmaker|clockmaker"),
  R("watches", null, words("שעונים", "שען", "watches", "watch$", "ساعات"), { gate: true }),
  R("perfume", null, words("בשמים", "perfume", "עטור", "عطور", "عطر", "بخور"), { gate: true }),
  R("chocolates", "shop=chocolate|dates"),
  R(
    "chocolates",
    null,
    words("שוקולד", "chocolat", "שוקולטרי", "شوكولا", "تمور", "תמרים", "dates$"),
    { gate: true },
  ),
  R(
    "electronics",
    "shop=electronics|mobile_phone|appliance|hifi|telecommunication|video|video_games|radiotechnics|vacuum_cleaner|electrical_appliances",
  ),
  R(
    "electronics",
    null,
    words(
      "סלולר",
      "סלולרי",
      "סלקום",
      "פרטנר",
      "הוט מובייל",
      "גולן טלקום",
      "פלאפון",
      "cellular",
      "mobile",
      "electronics",
      "electric",
      "חשמל",
      "מוצרי חשמל",
      "خلوي",
      "خلويات",
      "جوالات",
      "كهربائيات",
      "أدوات كهربائية",
      "פלאפון",
      "iDigital",
      "KSP",
      "באג",
    ),
    { gate: true },
  ),
  R("bookshops", "shop=books|stationery|gift|newsagent|souvenir|office_supplies"),
  R(
    "bookshops",
    null,
    words(
      "ספרים",
      "ספרי",
      "צומת ספרים",
      "סטימצקי",
      "כלי כתיבה",
      "מתנות",
      "books",
      "bookshop",
      "stationery",
      "gifts",
      "مكتبة",
      "قرطاسية",
      "هدايا",
      "كتب",
    ),
    { gate: true },
  ),
  R("artists", "shop=art|craft|pottery|frame_maker"),
  R("artists", "tourism=gallery"),
  R(
    "artists",
    "craft=handicraft|pottery|glassblower|sculptor|artist|ceramic|potter|embroiderer|weaver|basket_maker",
  ),
  R(
    "artists",
    null,
    words(
      "גלריה",
      "gallery",
      "סטודיו לאמנות",
      "קרמיקה",
      "ceramic",
      "pottery",
      "handmade",
      "עבודות יד",
      "معرض فني",
      "فخار",
      "فنون",
    ),
    { gate: true },
  ),
  R("pet-shops", "shop=pet|pet_grooming|pet_food|animal_feed"),
  R("pet-shops", "amenity=animal_boarding|animal_shelter|animal_training"),
  R(
    "pet-shops",
    null,
    words(
      "חיות מחמד",
      "חיות",
      "pet$",
      "pets",
      "פט שופ",
      "pet shop",
      "حيوانات",
      "طيور",
      "מזון לבעלי חיים",
    ),
    { gate: true },
  ),
  R(
    "shops",
    "shop=supermarket|convenience|general|department_store|variety_store|mall|kiosk|discount|wholesale_club",
  ),
  R("shops", "shop=*", null, { fallback: true }),
];

/** Amenities of businesses (gated word rules may name what they are). */
const BUSINESS_AMENITY = new Set([
  "studio",
  "training",
  "community_centre",
  "social_centre",
  "social_facility",
  "events_venue",
  "conference_centre",
  "clinic",
  "doctors",
  "marketplace",
  "arts_centre",
  "theatre",
  "music_school",
  "language_school",
  "driving_school",
  "prep_school",
  "car_rental",
  "taxi",
  "car_wash",
  "veterinary",
  "coworking_space",
  "internet_cafe",
  "money_transfer",
  "bureau_de_change",
  "post_depot",
  "nursing_home",
]);
/** Words-only rules: only for features with a business key. `gateAmenity` also lets sport and leisure in. */
function gateOpen(tags, rule) {
  if (rule.gateAll) return true;
  if (tags.shop || tags.office || tags.craft || tags.healthcare) return true;
  if (tags.amenity && BUSINESS_AMENITY.has(tags.amenity)) return true;
  if (rule.gateAmenity && (tags.leisure || tags.sport || tags.club || tags.amenity)) return true;
  if (rule.gateTourism && tags.tourism) return true;
  return false;
}

const compiled = RULES.map((r) => ({ ...r, test: r.t ? tagTest(r.t) : null }));
/** Tag rules first, then words-only rules, then the catch-alls (any other shop is a shop). */
const PASSES = [
  compiled.filter((r) => r.first),
  compiled.filter((r) => r.test && !r.fallback && !r.first),
  compiled.filter((r) => !r.test && !r.first),
  compiled.filter((r) => r.fallback),
];

/** Food is the food importer's: restaurants, cafés and food shops are never classified here. */
const FOOD = tagTest(
  "amenity=restaurant|cafe|fast_food|food_court|ice_cream|biergarten|shop=bakery|butcher|pastry|confectionery|ice_cream|coffee|tea|deli|seafood|spices|nuts|beverages|water|juice|food|frozen_food|health_food|chocolate_and_sweets|cake|catering",
);

/** Food chains sometimes mapped without a food tag. */
const FOOD_NAMES = words(
  "burger ranch",
  "בורגראנץ",
  "בורגר ראנץ",
  "מקדונלד",
  "mcdonald",
  "דומינו",
  "domino",
  "פיצה",
  "pizza",
  "שווארמה",
  "shawarma",
  "פלאפל",
  "falafel",
  "קפה ",
  "cafe",
  "café",
  "גלידה",
  "מאפיית",
  "מאפה",
);

/** Not a business to list: ritual baths, bus platforms, abandoned or closed places. */
const NOT_A_PLACE = words(
  "מקווה",
  "mikveh",
  "mikvah",
  "רציף",
  "platform",
  "abandoned",
  "disused",
  "נטוש",
  "closed$",
  "סגור$",
  "مهجور",
);

/** Garages, tyres, testing, fuel, charging and banks: other importers' official lists. */
const ELSEWHERE = tagTest(
  "shop=tyres|car_repair|car_body|car_painting|truck_repair|fuel|craft=car_repair|amenity=vehicle_inspection|fuel|charging_station|bank|atm",
);

/**
 * A feature's Darb kinds: { kinds: [primary, ...also], rule } | { excluded: why } | null (no
 * Darb kind, food, or a kind another importer owns).
 */
export function classify(tags, { kinds: active } = {}) {
  const why = excluded(tags);
  if (why) return { excluded: why };
  if (FOOD(tags) || ELSEWHERE(tags) || FOOD_NAMES.test(nameText(tags))) return null;
  if (tags["bath:type"] === "mikveh" || NOT_A_PLACE.test(nameText(tags))) return null;
  const text = nameText(tags);
  for (const pass of PASSES)
    for (const rule of pass) {
      if (rule.test && !rule.test(tags)) continue;
      if (!rule.test && !gateOpen(tags, rule)) continue;
      if (rule.w && !rule.w.test(text)) continue;
      const kinds = [rule.kind, ...(rule.also ?? [])].filter(
        (k) => !OWNED_ELSEWHERE.kinds.has(k) && (!active || active.has(k)),
      );
      if (!kinds.length) return null;
      return { kinds: [...new Set(kinds)], rule: describe(rule), attraction: rule.attraction };
    }
  return null;
}

/** A rule as text, for the audit: "shop=hairdresser + words". */
export function describe(rule) {
  return [rule.t, rule.w ? "name words" : null].filter(Boolean).join(" + ") || "?";
}

/** The OSM tags and word rules that can give each kind (for the coverage audit). */
export function sourcesByKind() {
  const out = {};
  for (const r of RULES) {
    for (const k of [r.kind, ...(r.also ?? [])]) {
      const s = (out[k] ??= { tags: new Set(), words: false });
      if (r.t) s.tags.add(r.t);
      if (r.w && !r.t) s.words = true;
    }
  }
  return out;
}
