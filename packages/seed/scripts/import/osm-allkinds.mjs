// Every named business OpenStreetMap has in the north, for every Darb kind outside food, garages
// and what phase 1 imported: one listing file per sector (data/listings/osm-<sector>-north.json).
// Kinds come from kind-map.mjs, chains from chains.mjs, hours from oh.mjs. Points are OSM's own
// (a node, or the centre of a way); a feature with no name is never listed.
// Run: node packages/seed/scripts/import/osm-allkinds.mjs [--refresh]
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { pathToFileURL } from "node:url";
import { CHAINS, chainOf } from "./chains.mjs";
import { similarNames, sameBusiness } from "./dedupe.mjs";
import {
  assignSlugs,
  business,
  ensureBrands,
  LISTINGS_DIR,
  NO_HOURS,
  slugBase,
  writeListing,
} from "./emit.mjs";
import { pointOf, today } from "./fetch.mjs";
import { classify, KIND_INFO } from "./kind-map.mjs";
import { createNamer, plainDashes } from "./names.mjs";
import { fromArabic, hasArabic, hasHebrew } from "./names-ar.mjs";
import { parseOpeningHours } from "./oh.mjs";
import { ALL_KINDS_QUERY } from "./osm-query.mjs";
import { OSM_ATTRIBUTION } from "./osm.mjs";
import { overpassTiles } from "./overpass-tiles.mjs";
import { normalizePhone } from "./phones.mjs";
import { createPlaceMatcher, km } from "./places.mjs";

export const FILE_PREFIX = "osm-";
export const fileFor = (sector) => `${FILE_PREFIX}${sector}-north.json`;
/** Same business: similar names within this distance (a shop mapped as a node and a building). */
export const SAME_M = 80;

/** Each sector's card accent, one of Darb's eight (CARD_ACCENTS in @darb/core). */
export const SECTOR_ACCENT = {
  beauty: "#d9aaa2",
  health: "#5fb3a8",
  sports: "#e08a6d",
  kids: "#d9a54c",
  education: "#6fa8dc",
  tech: "#5fb3a8",
  services: "#d6a473",
  home: "#a99bd6",
  industry: "#d6a473",
  auto: "#6fa8dc",
  agriculture: "#9fb86a",
  events: "#d9a54c",
  travel: "#a99bd6",
  retail: "#e08a6d",
  faith: "#9fb86a",
  civic: "#6fa8dc",
  community: "#d9a54c",
};

const L = (he, ar, en) => ({ he, ar, en });

/** Words in Hebrew business names, so a Hebrew-only name reads in Arabic and English. */
export const BUSINESS_WORDS = {
  "בית מרקחת": { ar: "صيدلية", en: "Pharmacy", after: true },
  "בית המרקחת": { ar: "صيدلية", en: "Pharmacy", after: true },
  "בית כנסת": { ar: "كنيس", en: "Synagogue", after: true },
  "בית הכנסת": { ar: "كنيس", en: "Synagogue", after: true },
  "בית כנסת מרכזי": { ar: "الكنيس المركزي", en: "Central Synagogue", after: true },
  ישיבת: { ar: "يشيفات", en: "Yeshivat" },
  מסגד: { ar: "مسجد", en: "Mosque", after: true },
  כנסיית: { ar: "كنيسة", en: "Church", after: true },
  כנסיה: { ar: "كنيسة", en: "Church", after: true },
  כנסייה: { ar: "كنيسة", en: "Church", after: true },
  מנזר: { ar: "دير", en: "Monastery", after: true },
  מספרה: { ar: "صالون حلاقة", en: "Barbershop", after: true },
  מספרת: { ar: "صالون حلاقة", en: "Barbershop", after: true },
  מרפאה: { ar: "عيادة", en: "Clinic", after: true },
  מרפאת: { ar: "عيادة", en: "Clinic", after: true },
  "מרפאת שיניים": { ar: "عيادة أسنان", en: "Dental Clinic", after: true },
  "מרכז רפואי": { ar: "مركز طبي", en: "Medical Centre", after: true },
  "בית חולים": { ar: "مستشفى", en: "Hospital", after: true },
  "בית החולים": { ar: "مستشفى", en: "Hospital", after: true },
  "קופת חולים": { ar: "صندوق المرضى", en: "Health Fund", after: true },
  "טיפת חלב": { ar: "محطة الأم والطفل", en: "Mother and Baby Clinic", after: true },
  אופטיקה: { ar: "بصريات", en: "Optics", after: true },
  "גן ילדים": { ar: "روضة", en: "Kindergarten", after: true },
  מעון: { ar: "حضانة", en: "Daycare", after: true },
  ספרייה: { ar: "مكتبة", en: "Library", after: true },
  ספריה: { ar: "مكتبة", en: "Library", after: true },
  ספריית: { ar: "مكتبة", en: "Library", after: true },
  "הספרייה העירונית": { ar: "المكتبة البلدية", en: "Public Library", after: true },
  עיריית: { ar: "بلدية", en: "Municipality", after: true },
  עירייה: { ar: "بلدية", en: "Municipality", after: true },
  "מועצה מקומית": { ar: "مجلس محلي", en: "Local Council", after: true },
  'מתנ"ס': { ar: "مركز جماهيري", en: "Community Centre", after: true },
  "מרכז קהילתי": { ar: "مركز جماهيري", en: "Community Centre", after: true },
  "סניף דואר": { ar: "بريد", en: "Post Office", after: true },
  דואר: { ar: "بريد", en: "Post Office", after: true },
  "בית דואר": { ar: "بريد", en: "Post Office", after: true },
  משטרה: { ar: "شرطة", en: "Police", after: true },
  משטרת: { ar: "شرطة", en: "Police", after: true },
  "תחנת משטרה": { ar: "مركز شرطة", en: "Police Station", after: true },
  "תחנת כיבוי אש": { ar: "إطفائية", en: "Fire Station", after: true },
  "תחנת כיבוי": { ar: "إطفائية", en: "Fire Station", after: true },
  כבאות: { ar: "إطفائية", en: "Fire Service", after: true },
  חניון: { ar: "موقف سيارات", en: "Car Park", after: true },
  "תחנה מרכזית": { ar: "المحطة المركزية", en: "Central Bus Station", after: true },
  "תחנת רכבת": { ar: "محطة قطار", en: "Train Station", after: true },
  רכבת: { ar: "قطار", en: "Train", after: true },
  מלון: { ar: "فندق", en: "Hotel", after: true },
  צימר: { ar: "تسيمر", en: "Zimmer", after: true },
  צימרים: { ar: "تسيمرات", en: "Zimmers", after: true },
  אכסניית: { ar: "نزل", en: "Hostel", after: true },
  אכסניה: { ar: "نزل", en: "Hostel", after: true },
  "בית ספר": { ar: "مدرسة", en: "School", after: true },
  חנות: { ar: "محل", en: "Shop", after: true },
  סופר: { ar: "سوبر", en: "Super" },
  מכולת: { ar: "دكانة", en: "Grocery", after: true },
  מרכול: { ar: "ماركت", en: "Market", after: true },
  אולם: { ar: "قاعة", en: "Hall", after: true },
  אולמי: { ar: "قاعات", en: "Halls", after: true },
  "גן אירועים": { ar: "حديقة مناسبات", en: "Event Garden", after: true },
  "חדר כושר": { ar: "جيم", en: "Gym", after: true },
  בריכה: { ar: "بركة", en: "Pool", after: true },
  בריכת: { ar: "بركة", en: "Pool", after: true },
  מועדון: { ar: "نادي", en: "Club", after: true },
  "בית עלמין": { ar: "مقبرة", en: "Cemetery", after: true },
  "בית העלמין": { ar: "مقبرة", en: "Cemetery", after: true },
  משרד: { ar: "مكتب", en: "Office", after: true },
  'עו"ד': { ar: "المحامي", en: "Adv." },
  'רו"ח': { ar: "المحاسب", en: "CPA" },
  'ד"ר': { ar: "د.", en: "Dr." },
  מוזיאון: { ar: "متحف", en: "Museum", after: true },
  "חוות סוסים": { ar: "إسطبل خيل", en: "Ranch", after: true },
  חוות: { ar: "مزرعة", en: "Farm", after: true },
  משתלת: { ar: "مشتل", en: "Nursery", after: true },
  משתלה: { ar: "مشتل", en: "Nursery", after: true },
  פרחי: { ar: "ورود", en: "Flowers", after: true },
  מתוקים: { ar: "حلويات", en: "Sweets", after: true },
  ספורט: { ar: "سبورت", en: "Sport", after: true },
  אופנה: { ar: "أزياء", en: "Fashion", after: true },
  רהיטי: { ar: "أثاث", en: "Furniture", after: true },
  רהיטים: { ar: "أثاث", en: "Furniture", after: true },
  סלולר: { ar: "خلوي", en: "Cellular", after: true },
  חשמל: { ar: "كهرباء", en: "Electric", after: true },
  "מוצרי חשמל": { ar: "كهربائيات", en: "Electronics", after: true },
  'נדל"ן': { ar: "عقارات", en: "Real Estate", after: true },
  ביטוח: { ar: "تأمين", en: "Insurance", after: true },
  ביטוחים: { ar: "تأمين", en: "Insurance", after: true },
  "חומרי בניין": { ar: "مواد بناء", en: "Building Supplies", after: true },
  "כלי בית": { ar: "أدوات منزلية", en: "Housewares", after: true },
  צעצועים: { ar: "ألعاب", en: "Toys", after: true },
  תכשיטי: { ar: "مجوهرات", en: "Jewellery", after: true },
  תכשיטים: { ar: "مجوهرات", en: "Jewellery", after: true },
  שעוני: { ar: "ساعات", en: "Watches", after: true },
  נעלי: { ar: "أحذية", en: "Shoes", after: true },
  בגדי: { ar: "ملابس", en: "Clothing", after: true },
  "חלקי חילוף": { ar: "قطع غيار", en: "Auto Parts", after: true },
  השכרת: { ar: "تأجير", en: "Rental", after: true },
  "השכרת רכב": { ar: "تأجير سيارات", en: "Car Rental", after: true },
  "שטיפת רכב": { ar: "غسيل سيارات", en: "Car Wash", after: true },
  מוניות: { ar: "تكاسي", en: "Taxis", after: true },
  נגריית: { ar: "منجرة", en: "Carpentry", after: true },
  נגריה: { ar: "منجرة", en: "Carpentry", after: true },
  מסגריית: { ar: "حدادة", en: "Metalworks", after: true },
  מפעל: { ar: "مصنع", en: "Factory", after: true },
  תעשיות: { ar: "صناعات", en: "Industries", after: true },
  מכללת: { ar: "كلية", en: "College", after: true },
  מכללה: { ar: "كلية", en: "College", after: true },
  אוניברסיטת: { ar: "جامعة", en: "University", after: true },
  "בית אבות": { ar: "دار مسنين", en: "Care Home", after: true },
  עמותת: { ar: "جمعية", en: "Association", after: true },
  "בית הספר לנהיגה": { ar: "مدرسة سياقة", en: "Driving School", after: true },
  נוי: { ar: "نوي", en: "Noy" },
  גלריה: { ar: "جاليري", en: "Gallery", after: true },
  גלריית: { ar: "جاليري", en: "Gallery", after: true },
  סטודיו: { ar: "ستوديو", en: "Studio", after: true },
  קניון: { ar: "مول", en: "Mall", after: true },
};

const LABEL = {
  chain: L("רשת", "شبكة", "Chain"),
  access: L("נגיש לכיסא גלגלים", "مناسب للكراسي المتحركة", "Wheelchair accessible"),
  delivery: L("משלוחים", "توصيل", "Delivery"),
  prescriptions: L("מרשמים", "وصفات طبية", "Prescriptions"),
  stars: L("דירוג כוכבים", "نجوم", "Stars"),
  rooms: L("חדרים", "غرف", "Rooms"),
  denomination: L("זרם", "طائفة", "Denomination"),
  sports: L("ענפים", "رياضات", "Sports"),
  specialities: L("תחומים", "تخصصات", "Specialities"),
  sells: L("מה יש", "شو في", "What's here"),
  emergency: L("חדר מיון", "طوارئ", "Emergency room"),
  open247: L("פתוח 24/7", "فاتح 24/7", "Open 24/7"),
  cta: L("ניווט למקום", "خذني لهناك", "Navigate there"),
};

/** OSM values worth saying on a card (and found by deep search), in three languages. */
const VALUE_WORDS = {
  sport: {
    soccer: L("כדורגל", "كرة قدم", "Football"),
    basketball: L("כדורסל", "كرة سلة", "Basketball"),
    tennis: L("טניס", "تنس", "Tennis"),
    padel: L("פאדל", "بادل", "Padel"),
    swimming: L("שחייה", "سباحة", "Swimming"),
    fitness: L("כושר", "لياقة", "Fitness"),
    yoga: L("יוגה", "يوغا", "Yoga"),
    pilates: L("פילאטיס", "بيلاتس", "Pilates"),
    karate: L("קראטה", "كاراتيه", "Karate"),
    judo: L("ג'ודו", "جودو", "Judo"),
    taekwondo: L("טאקוונדו", "تايكوندو", "Taekwondo"),
    boxing: L("אגרוף", "ملاكمة", "Boxing"),
    martial_arts: L("אומנויות לחימה", "فنون قتالية", "Martial arts"),
    volleyball: L("כדורעף", "كرة طائرة", "Volleyball"),
    handball: L("כדוריד", "كرة يد", "Handball"),
    equestrian: L("רכיבה על סוסים", "ركوب خيل", "Horse riding"),
    climbing: L("טיפוס", "تسلق", "Climbing"),
    gymnastics: L("התעמלות", "جمباز", "Gymnastics"),
    dance: L("מחול", "رقص", "Dance"),
    golf: L("גולף", "جولف", "Golf"),
    bowling: L("באולינג", "بولينج", "Bowling"),
    ice_skating: L("החלקה על הקרח", "تزلج على الجليد", "Ice skating"),
    crossfit: L("קרוספיט", "كروسفيت", "CrossFit"),
  },
  denomination: {
    catholic: L("קתולית", "كاثوليك", "Catholic"),
    roman_catholic: L("קתולית", "كاثوليك", "Roman Catholic"),
    greek_catholic: L("יוונית קתולית", "روم كاثوليك", "Greek Catholic"),
    melkite: L("יוונית קתולית", "روم كاثوليك", "Melkite"),
    orthodox: L("אורתודוקסית", "أرثوذكس", "Orthodox"),
    greek_orthodox: L("יוונית אורתודוקסית", "روم أرثوذكس", "Greek Orthodox"),
    maronite: L("מרונית", "موارنة", "Maronite"),
    anglican: L("אנגליקנית", "أنجليكان", "Anglican"),
    baptist: L("בפטיסטית", "معمدانية", "Baptist"),
    lutheran: L("לותרנית", "لوثرية", "Lutheran"),
    armenian_apostolic: L("ארמנית", "أرمن", "Armenian"),
    sunni: L("סונית", "سنة", "Sunni"),
    ahmadiyya: L("אחמדייה", "أحمدية", "Ahmadiyya"),
    ashkenazi: L("אשכנזי", "أشكناز", "Ashkenazi"),
    sephardi: L("ספרדי", "سفارديم", "Sephardi"),
    orthodox_jewish: L("אורתודוקסי", "أرثوذكسي", "Orthodox"),
  },
  "healthcare:speciality": {
    general: L("רפואה כללית", "طب عام", "General practice"),
    paediatrics: L("רפואת ילדים", "طب أطفال", "Paediatrics"),
    gynaecology: L("נשים", "نسائية", "Gynaecology"),
    dermatology: L("עור", "جلدية", "Dermatology"),
    ophthalmology: L("עיניים", "عيون", "Ophthalmology"),
    orthopaedics: L("אורתופדיה", "عظام", "Orthopaedics"),
    cardiology: L("קרדיולוגיה", "قلب", "Cardiology"),
    dentist: L("שיניים", "أسنان", "Dentistry"),
    orthodontics: L("יישור שיניים", "تقويم أسنان", "Orthodontics"),
    physiotherapy: L("פיזיותרפיה", "علاج طبيعي", "Physiotherapy"),
    psychiatry: L("פסיכיאטריה", "طب نفسي", "Psychiatry"),
    otolaryngology: L("אף אוזן גרון", "أنف أذن حنجرة", "ENT"),
    emergency: L("רפואה דחופה", "طوارئ", "Urgent care"),
    radiology: L("דימות", "أشعة", "Imaging"),
    blood_check: L("בדיקות דם", "فحوصات دم", "Blood tests"),
  },
};

/** Shop types said as an item, so a search for the thing finds the shop. */
const SHOP_WORDS = {
  supermarket: L("סופרמרקט", "سوبرماركت", "Supermarket"),
  convenience: L("מכולת", "دكانة", "Convenience store"),
  kiosk: L("קיוסק", "كشك", "Kiosk"),
  department_store: L("כלבו", "محل متعدد الأقسام", "Department store"),
  variety_store: L("הכל בזול", "كل شي بسعر قليل", "Variety store"),
  mall: L("קניון", "مول", "Mall"),
  general: L("מכולת", "دكانة", "General store"),
  music: L("מוזיקה", "موسيقى", "Music"),
  musical_instrument: L("כלי נגינה", "آلات موسيقية", "Musical instruments"),
  hardware: L("כלי עבודה ובניין", "عدة وأدوات بناء", "Hardware"),
  doityourself: L("עשה זאת בעצמך", "أدوات وعدة", "DIY"),
  building_materials: L("חומרי בניין", "مواد بناء", "Building materials"),
  tiles: L("קרמיקה ואריחים", "بلاط وسيراميك", "Tiles"),
  bathroom_furnishing: L("כלים סניטריים", "أدوات صحية", "Bathroom fittings"),
  paint: L("צבעים", "دهانات", "Paint"),
  mobile_phone: L("טלפונים ניידים", "خلويات", "Mobile phones"),
  computer: L("מחשבים", "كمبيوترات", "Computers"),
  electronics: L("מוצרי חשמל", "كهربائيات", "Electronics"),
  appliance: L("מכשירי חשמל לבית", "أجهزة كهربائية للبيت", "Home appliances"),
  shoes: L("נעליים", "أحذية", "Shoes"),
  clothes: L("בגדים", "ملابس", "Clothes"),
  bag: L("תיקים", "شنط", "Bags"),
  books: L("ספרים", "كتب", "Books"),
  stationery: L("כלי כתיבה", "قرطاسية", "Stationery"),
  gift: L("מתנות", "هدايا", "Gifts"),
  toys: L("צעצועים", "ألعاب", "Toys"),
  furniture: L("רהיטים", "أثاث", "Furniture"),
  bed: L("מיטות ומזרנים", "تخوت وفرشات", "Beds and mattresses"),
  mattress: L("מזרנים", "فرشات", "Mattresses"),
  florist: L("פרחים", "ورد", "Flowers"),
  optician: L("משקפיים ועדשות", "نظارات وعدسات", "Glasses and lenses"),
  hearing_aids: L("מכשירי שמיעה", "سماعات أذن", "Hearing aids"),
  pet: L("מזון וציוד לחיות", "أكل وأغراض للحيوانات", "Pet food and supplies"),
  bicycle: L("אופניים", "بسكليتات", "Bicycles"),
  sports: L("ציוד ספורט", "معدات رياضة", "Sports gear"),
  jewelry: L("תכשיטים", "مجوهرات", "Jewellery"),
  cosmetics: L("קוסמטיקה", "مستحضرات تجميل", "Cosmetics"),
  perfumery: L("בשמים", "عطور", "Perfume"),
  car: L("מכירת רכבים", "بيع سيارات", "Cars for sale"),
  car_parts: L("חלקי חילוף", "قطع غيار", "Car parts"),
  motorcycle: L("אופנועים", "دراجات نارية", "Motorbikes"),
  garden_centre: L("צמחים ועציצים", "نباتات وأشتال", "Plants and pots"),
  agrarian: L("אספקה חקלאית", "لوازم زراعية", "Farm supplies"),
  houseware: L("כלי בית", "أدوات منزلية", "Housewares"),
  interior_decoration: L("עיצוב הבית", "ديكور", "Home decor"),
  lighting: L("תאורה", "إضاءة", "Lighting"),
  carpet: L("שטיחים", "سجاد", "Carpets"),
  curtain: L("וילונות", "برادي", "Curtains"),
  fabric: L("בדים", "أقمشة", "Fabrics"),
  sewing: L("תפירה", "خياطة", "Sewing"),
  copyshop: L("צילום מסמכים", "تصوير مستندات", "Copying"),
  photo: L("צילום", "تصوير", "Photo"),
  dry_cleaning: L("ניקוי יבש", "دراي كلين", "Dry cleaning"),
  laundry: L("כביסה", "غسيل", "Laundry"),
  tailor: L("תיקוני תפירה", "تصليح ملابس", "Alterations"),
  locksmith: L("מפתחות ומנעולים", "مفاتيح وأقفال", "Keys and locks"),
  second_hand: L("יד שנייה", "مستعمل", "Second hand"),
  charity: L("יד שנייה", "مستعمل", "Second hand"),
  baby_goods: L("מוצרי תינוקות", "أغراض أطفال", "Baby goods"),
  medical_supply: L("ציוד רפואי", "معدات طبية", "Medical supplies"),
  chemist: L("פארם וטיפוח", "صيدلية وعناية", "Drugstore"),
  wholesale: L("סיטונאות", "جملة", "Wholesale"),
  frame: L("מסגרות לתמונות", "براويز", "Picture frames"),
  art: L("אמנות", "فن", "Art"),
  craft: L("יצירה", "أشغال يدوية", "Crafts"),
  outdoor: L("ציוד שטח", "معدات رحلات", "Outdoor gear"),
  fishing: L("ציוד דיג", "معدات صيد", "Fishing gear"),
  watches: L("שעונים", "ساعات", "Watches"),
  religion: L("תשמישי קדושה", "أغراض دينية", "Religious items"),
  trade: L("ספקים לבעלי מקצוע", "مستلزمات للمهنيين", "Trade supplies"),
  electrical: L("ציוד חשמל", "أدوات كهرباء", "Electrical supplies"),
  gas: L("גז", "غاز", "Gas"),
  storage_rental: L("השכרת מחסנים", "تأجير مخازن", "Storage rental"),
  party: L("ציוד למסיבות", "أغراض حفلات", "Party supplies"),
  hairdresser_supply: L("ציוד למספרות", "لوازم صالونات", "Salon supplies"),
  beauty: L("טיפולי יופי", "علاجات تجميل", "Beauty treatments"),
  hairdresser: L("תספורות", "قص شعر", "Haircuts"),
  kitchen: L("מטבחים", "مطابخ", "Kitchens"),
  boutique: L("בוטיק", "بوتيك", "Boutique"),
  video_games: L("משחקי וידאו", "ألعاب فيديو", "Video games"),
  games: L("משחקים", "ألعاب", "Games"),
  e_cigarette: null,
};

/** A name in three languages from OSM's name tags, transliterating what is missing. */
export function namesFor(tags, namer, place) {
  const base = plainDashes(tags.name ?? "");
  let he = tags["name:he"] ?? (hasHebrew(base) ? base : null);
  let ar = tags["name:ar"] ?? (!hasHebrew(base) && hasArabic(base) ? base : null);
  let en = tags["name:en"] ?? (!hasHebrew(base) && !hasArabic(base) && base ? base : null);
  if (!he && ar) he = fromArabic(ar).he;
  if (!he) he = en;
  if (!he) return null;
  const fromHe = hasHebrew(he) ? namer.name(he, place) : null;
  if (!ar) ar = fromHe?.ar ?? en ?? he;
  if (!en) en = hasArabic(ar) && !fromHe ? fromArabic(ar).en : (fromHe?.en ?? he);
  return { he: plainDashes(he), ar: plainDashes(ar), en: plainDashes(en) };
}

const asUrl = (raw) => {
  const v = String(raw ?? "")
    .split(";")[0]
    .trim();
  if (!v || /\s/.test(v)) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(v)) return `https://${v}`;
  return null;
};
const social = (raw, host) => {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").replace(new RegExp(`^(www\\.)?${host}/`), "");
  return /^[\w.]+$/.test(handle) ? `https://www.${host}/${handle}` : null;
};

const listOf = (v) =>
  String(v ?? "")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
/** Known values of a ;-list tag, said once each in three languages and joined. */
function sayValues(key, raw) {
  const said = [];
  for (const v of listOf(raw)) {
    const w = VALUE_WORDS[key]?.[v];
    if (w && !said.some((s) => s.en === w.en)) said.push(w);
  }
  if (!said.length) return null;
  return L(
    said.map((s) => s.he).join(", "),
    said.map((s) => s.ar).join("، "),
    said.map((s) => s.en).join(", "),
  );
}

/** The card's items: what it is, its chain and what OSM says it offers. */
export function itemsFor(tags, kind, chain) {
  const one = KIND_INFO[kind].one;
  const shopWord = SHOP_WORDS[tags.shop];
  const items =
    kind === "shops" && shopWord
      ? [{ label: shopWord }]
      : [{ label: one, ...(shopWord && shopWord.en !== one.en ? { meta: shopWord } : {}) }];
  if (chain) items.push({ label: LABEL.chain, meta: chain.name });
  const sports = sayValues("sport", tags.sport);
  if (sports) items.push({ label: LABEL.sports, meta: sports });
  const spec = sayValues("healthcare:speciality", tags["healthcare:speciality"]);
  if (spec) items.push({ label: LABEL.specialities, meta: spec });
  const den = sayValues("denomination", tags.denomination);
  if (den) items.push({ label: LABEL.denomination, meta: den });
  if (tags.dispensing === "yes") items.push({ label: LABEL.prescriptions });
  if (tags.emergency === "yes" && (tags.amenity === "hospital" || tags.healthcare === "hospital"))
    items.push({ label: LABEL.emergency });
  if (/^[1-7]S?$/.test(tags.stars ?? ""))
    items.push({ label: LABEL.stars, meta: L(tags.stars[0], tags.stars[0], tags.stars[0]) });
  if (/^\d{1,4}$/.test(tags.rooms ?? ""))
    items.push({ label: LABEL.rooms, meta: L(tags.rooms, tags.rooms, tags.rooms) });
  if (tags.delivery === "yes") items.push({ label: LABEL.delivery });
  if (tags.wheelchair === "yes") items.push({ label: LABEL.access });
  if (tags.opening_hours?.trim() === "24/7") items.push({ label: LABEL.open247 });
  return items.slice(0, 8);
}

/** "בית מרקחת בכרמיאל", "صيدلية في كرميئيل", "Pharmacy in Karmiel". */
export function taglineFor(kind, place, tags = {}) {
  const one =
    kind === "shops" && SHOP_WORDS[tags.shop] ? SHOP_WORDS[tags.shop] : KIND_INFO[kind].one;
  const town = (l) =>
    String(place.name[l] ?? "")
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .trim();
  return L(`${one.he} ב${town("he")}`, `${one.ar} في ${town("ar")}`, `${one.en} in ${town("en")}`);
}

const HALAL = /(?<![\p{L}])(halal|حلال|חלאל)(?![\p{L}])/iu;

/** Pure, for fixtures: OSM elements to listings by sector. */
export function buildAllKinds({ elements, existing = [], kinds, sectors }) {
  const kindBySlug = new Map(kinds.map((k) => [k.slug, k]));
  const active = new Set(
    kinds.filter((k) => k.status === "active" && k.sector !== "food").map((k) => k.slug),
  );
  const matcher = createPlaceMatcher();
  const namer = createNamer(undefined, { extraWords: BUSINESS_WORDS });
  const counts = {
    fetched: elements.length,
    excluded: 0,
    unmapped: 0,
    noName: 0,
    attractionNoContact: 0,
    privateAccess: 0,
    outsideNorth: 0,
    pointFarFromTown: 0,
    halalWord: 0,
  };
  const excludedWhy = {};
  const unmapped = {};
  const businesses = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    if (!tags.name && !tags["name:he"] && !tags["name:ar"]) {
      counts.noName++;
      continue;
    }
    const c = classify(tags, { kinds: active });
    if (!c) {
      counts.unmapped++;
      const key = ["shop", "amenity", "office", "craft", "healthcare", "tourism", "leisure", "club"]
        .filter((k) => tags[k])
        .map((k) => `${k}=${tags[k]}`)[0];
      if (key) unmapped[key] = (unmapped[key] ?? 0) + 1;
      continue;
    }
    if (c.excluded) {
      counts.excluded++;
      excludedWhy[c.excluded] = (excludedWhy[c.excluded] ?? 0) + 1;
      continue;
    }
    if (["private", "no"].includes(tags.access)) {
      counts.privateAccess++;
      continue;
    }
    // A sight is listed when it runs like a place you visit: hours, a phone, a site or a fee.
    if (
      c.attraction &&
      !(
        tags.opening_hours ||
        tags.phone ||
        tags["contact:phone"] ||
        tags.website ||
        tags.fee === "yes"
      )
    ) {
      counts.attractionNoContact++;
      continue;
    }
    const point = pointOf(el);
    const m = matcher.match({
      town: tags["addr:city"] ?? tags["addr:city:he"],
      lat: point.lat,
      lng: point.lng,
    });
    if (m?.how === "conflict") {
      counts.pointFarFromTown++;
      continue;
    }
    if (!m || !matcher.inNorth(m.place.slug)) {
      counts.outsideNorth++;
      continue;
    }
    const place = m.place;
    const name = namesFor(tags, namer, place);
    if (!name) {
      counts.noName++;
      continue;
    }
    const primary = c.kinds[0];
    const sector = kindBySlug.get(primary).sector;
    const chain = chainOf(tags, c.kinds);
    if (chain && !tags["name:ar"] && !hasArabic(tags.name)) {
      // A chain's branch reads as the chain and its town in Arabic and English.
      const rest = (l) =>
        String(place.name[l])
          .replace(/\s*\([^)]*\)\s*/g, " ")
          .trim();
      if (!tags["name:ar"]) name.ar = `${chain.name.ar} ${rest("ar")}`;
      if (!tags["name:en"]) name.en = `${chain.name.en} ${rest("en")}`;
    }
    const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
    const phone = normalizePhone(
      tags.phone ?? tags["contact:phone"] ?? tags["contact:mobile"] ?? tags.mobile,
    );
    const hours = parseOpeningHours(tags.opening_hours);
    const links = {};
    const ig = social(tags["contact:instagram"] ?? tags.instagram, "instagram.com");
    const fb = social(tags["contact:facebook"] ?? tags.facebook, "facebook.com");
    if (ig) links.instagram = ig;
    if (fb) links.facebook = fb;
    const attributes = { osmId: `${el.type}/${el.id}` };
    if (tags.delivery === "yes") attributes.delivers = true;
    if (tags.wheelchair === "yes") attributes.wheelchair = true;
    let slug;
    try {
      slug = slugBase("", name.en);
    } catch {
      slug = slugBase(primary, `${el.id}`);
    }
    const one =
      primary === "shops" && SHOP_WORDS[tags.shop] ? SHOP_WORDS[tags.shop] : KIND_INFO[primary].one;
    const b = business({
      slug,
      place: place.slug,
      brand: chain?.slug ?? null,
      kinds: c.kinds,
      name,
      tagline: taglineFor(primary, place, tags),
      address: {
        he: street || place.name.he,
        ar: tags["addr:street:ar"] ?? place.name.ar,
        en: tags["addr:street:en"] ?? place.name.en,
      },
      lat: point.lat,
      lng: point.lng,
      hours: hours ?? NO_HOURS,
      attributes,
      phone,
      website: asUrl(tags.website ?? tags["contact:website"] ?? tags.url),
      links,
      screen: { title: one, items: itemsFor(tags, primary, chain), cta: LABEL.cta },
      accent: SECTOR_ACCENT[sector] ?? "#d9a54c",
    });
    if (HALAL.test(JSON.stringify(b))) {
      counts.halalWord++;
      continue;
    }
    b._sector = sector;
    b._rule = c.rule;
    businesses.push(b);
  }
  counts.classified = businesses.length;

  const { kept, dropped } = dedupeNear(businesses, existing);
  counts.duplicates = dropped.filter((d) => d.why === "duplicate").length;
  counts.alreadyListed = dropped.filter((d) => d.why === "existing").length;
  assignSlugs(kept, existing);
  const bySector = {};
  const rules = {};
  for (const b of kept) {
    (bySector[b._sector] ??= []).push(b);
    rules[b.primaryKind] ??= {};
    rules[b.primaryKind][b._rule] = (rules[b.primaryKind][b._rule] ?? 0) + 1;
    delete b._sector;
    delete b._rule;
  }
  counts.emitted = kept.length;
  for (const s of sectors) bySector[s.slug] ??= [];
  return { bySector, counts, excludedWhy, unmapped, rules, dropped };
}

/** Grid cells about 110 m tall, so a neighbour search looks at nine cells. */
const cellOf = (p) => `${Math.floor(p.lat / 0.001)}:${Math.floor(p.lng / 0.0012)}`;
const neighbours = (p) => {
  const a = Math.floor(p.lat / 0.001);
  const b = Math.floor(p.lng / 0.0012);
  const out = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(`${a + i}:${b + j}`);
  return out;
};
const shareKind = (a, b) => a.kinds.some((k) => b.kinds.includes(k));

/** Same business inside this import: kinds meet, within 80 m, and similar names or one chain. */
export function sameHere(a, b) {
  if (!shareKind(a, b)) return false;
  if (a.brand && b.brand && a.brand !== b.brand) return false;
  const m = km(a, b) * 1000;
  if (m > SAME_M) return false;
  if (a.brand && a.brand === b.brand && a.primaryKind === b.primaryKind && m <= 40) return true;
  return similarNames(a.name, b.name);
}

/**
 * Removes features already listed by another importer (dedupe.mjs's rule) and twins inside this
 * import (a node and its building, two mappers' points): the richer card stays.
 */
export function dedupeNear(records, existing = []) {
  const grid = new Map();
  const add = (map, r) => {
    const k = cellOf(r);
    (map.get(k) ?? map.set(k, []).get(k)).push(r);
  };
  const existingGrid = new Map();
  for (const e of existing) add(existingGrid, e);
  const dropped = [];
  const score = (x) =>
    (x.phone ? 2 : 0) +
    (x.website ? 1 : 0) +
    (Object.keys(x.hours.weekly).length ? 2 : 0) +
    x.experience.items.length +
    Object.keys(x.links).length +
    (x.attributes.osmId.startsWith("node") ? 0 : 0.5);
  const kept = [];
  for (const r of records) {
    const near = neighbours(r).flatMap((k) => existingGrid.get(k) ?? []);
    const twin = near.find((e) => sameBusiness(r, e));
    if (twin) {
      dropped.push({ record: r, keptAs: `${twin.place}/${twin.slug}`, why: "existing" });
      continue;
    }
    const mine = neighbours(r).flatMap((k) => grid.get(k) ?? []);
    const other = mine.find((k) => !k._gone && sameHere(r, k));
    if (!other) {
      add(grid, r);
      kept.push(r);
      continue;
    }
    if (score(r) > score(other)) {
      other._gone = true;
      add(grid, r);
      kept.push(r);
      dropped.push({ record: other, keptAs: r.attributes.osmId, why: "duplicate" });
    } else dropped.push({ record: r, keptAs: other.attributes.osmId, why: "duplicate" });
  }
  const out = kept.filter((r) => !r._gone);
  for (const r of records) delete r._gone;
  return { kept: out, dropped };
}

const read = (file) =>
  JSON.parse(readFileSync(new URL(`../../data/${file}`, import.meta.url), "utf8"));

async function main() {
  const elements = await overpassTiles("allkinds", ALL_KINDS_QUERY);
  const kinds = read("kinds.json");
  const sectors = read("sectors.json").filter((s) => s.slug !== "food");
  const mine = new Set(sectors.map((s) => fileFor(s.slug)));
  const { bySector, counts, excludedWhy, unmapped, rules } = buildAllKinds({
    elements,
    existing: existingOutside(mine),
    kinds,
    sectors,
  });
  const used = new Set(Object.values(bySector).flatMap((list) => list.map((b) => b.brand)));
  ensureBrands(CHAINS.filter((c) => used.has(c.slug)));
  for (const s of sectors) {
    const file = fileFor(s.slug);
    const list = bySector[s.slug];
    if (!list.length) {
      if (existsSync(new URL(file, LISTINGS_DIR))) unlinkSync(new URL(file, LISTINGS_DIR));
      continue;
    }
    writeListing(
      file,
      {
        name: `OpenStreetMap, every named ${s.name.en.toLowerCase()} business in the north`,
        url: "https://www.openstreetmap.org",
        licence: "Open Database License (ODbL)",
        attribution: OSM_ATTRIBUTION,
        region: "northern-district, haifa-district",
        fetched: today(),
        query:
          "named shop, office, craft, healthcare, tourism, club, amenity, leisure, emergency, works and industrial features, bbox 32.3,34.85,33.35,35.9 in 25 tiles",
        left_out:
          "features with no name, food (the food importer's), garages, tyres, testing, fuel, banks and EV charging (official lists), bars, alcohol, pork, gambling and lottery, adult shops, tobacco, vape and cannabis, tattoo and weapons shops, private places, sights with no hours or contact",
        hours: "from OSM opening_hours where it reads for certain; otherwise none",
        counts: { emitted: list.length, ...(s.slug === sectors[0].slug ? counts : {}) },
      },
      list,
    );
  }
  const CACHE = new URL("./.cache/", import.meta.url);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(
    new URL("allkinds-stats.json", CACHE),
    JSON.stringify({ counts, excludedWhy, unmapped, rules }, null, 1),
  );
  console.log(JSON.stringify(counts));
  console.log(
    Object.entries(bySector)
      .map(([s, l]) => `${s} ${l.length}`)
      .join(", "),
  );
}

/** Every listing outside this importer's own files (they are rewritten), plus Darb's clients. */
function existingOutside(mine) {
  const all = [];
  for (const file of readdirSync(LISTINGS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()) {
    if (mine.has(file)) continue;
    all.push(...JSON.parse(readFileSync(new URL(file, LISTINGS_DIR), "utf8")).businesses);
  }
  all.push(...read("clients.json").businesses);
  return all;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
