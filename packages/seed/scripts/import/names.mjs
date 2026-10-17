// Hebrew names into Arabic and English, deterministic and offline: a place's own names for town
// parts, a small word list for what stations and branches are called ("צומת", "מרכז", "צפון"),
// and plain letter maps for everything else. Never a translation service.
import { loadDarbPlaces, loose, normalize, variants } from "./places.mjs";

/**
 * Known words. `after: true` means English puts it after the rest ("X Junction"), while Hebrew
 * and Arabic keep the source order ("צומת X", "مفرق X"). `adj` words follow their noun in all
 * three ("עכו צפון", "عكا الشمالية", "Akko North").
 */
export const WORDS = {
  צומת: { ar: "مفرق", en: "Junction", after: true },
  מחלף: { ar: "مفرق", en: "Interchange", after: true },
  מרכז: { ar: "مركز", en: "Centre", after: true },
  כניסה: { ar: "مدخل", en: "Entrance", after: true },
  מבוא: { ar: "مدخل", en: "Gateway", after: true },
  מבואות: { ar: "مداخل", en: "Gateway", after: true },
  קניון: { ar: "مول", en: "Mall", after: true },
  "אזור תעשייה": { ar: "المنطقة الصناعية", en: "Industrial Zone", after: true },
  "א ת": { ar: "المنطقة الصناعية", en: "Industrial Zone", after: true },
  'א"ת': { ar: "المنطقة الصناعية", en: "Industrial Zone", after: true },
  "פארק תעשייה": { ar: "المنطقة الصناعية", en: "Industrial Park", after: true },
  גשר: { ar: "جسر", en: "Bridge", after: true },
  נמל: { ar: "ميناء", en: "Port", after: true },
  חוף: { ar: "شاطئ", en: "Beach", after: true },
  כביש: { ar: "شارع", en: "Road", after: true },
  דרך: { ar: "طريق", en: "Road", after: true },
  שדרות: { ar: "شارع", en: "Boulevard", after: true },
  רחוב: { ar: "شارع", en: "Street", after: true },
  שוק: { ar: "سوق", en: "Market", after: true },
  הר: { ar: "جبل", en: "Mount" },
  כרמל: { ar: "الكرمل", en: "Carmel" },
  הכרמל: { ar: "الكرمل", en: "Carmel" },
  גליל: { ar: "الجليل", en: "Galilee" },
  הגליל: { ar: "الجليل", en: "Galilee" },
  גלבוע: { ar: "جلبوع", en: "Gilboa" },
  הגלבוע: { ar: "جلبوع", en: "Gilboa" },
  מפרץ: { ar: "الخليج", en: "Bay" },
  שער: { ar: "بوابة", en: "Gate", after: true },
  חרמון: { ar: "حرمون", en: "Hermon" },
  החרמון: { ar: "حرمون", en: "Hermon" },
  כפר: { ar: "كفر", en: "Kfar" },
  קיבוץ: { ar: "كيبوتس", en: "Kibbutz" },
  // Common words in business names, Hebrew-spelt from Arabic or English.
  אבו: { ar: "أبو", en: "Abu" },
  אל: { ar: "ال", en: "al" },
  פואד: { ar: "فؤاد", en: "Fuad" },
  מוחמד: { ar: "محمد", en: "Mohammad" },
  אחמד: { ar: "أحمد", en: "Ahmad" },
  מוטורס: { ar: "موتورز", en: "Motors" },
  סנטר: { ar: "سنتر", en: "Center" },
  קאר: { ar: "كار", en: "Car" },
  סטאר: { ar: "ستار", en: "Star" },
  גולד: { ar: "جولد", en: "Gold" },
  אנרגיה: { ar: "إنرجي", en: "Energy" },
  אקספרס: { ar: "إكسبرس", en: "Express" },
  שירות: { ar: "خدمة", en: "Service" },
  שירותי: { ar: "خدمات", en: "Services" },
  מושב: { ar: "موشاف", en: "Moshav" },
  גבעת: { ar: "جفعات", en: "Givat" },
  פארק: { ar: "بارك", en: "Park", after: true },
  המפרץ: { ar: "الخليج", en: "Bay" },
  "מועצה אזורית": { ar: "مجلس إقليمي", en: "Regional Council", after: true },
  עמק: { ar: "مرج", en: "Valley", after: true },
  צפון: { ar: "الشمالية", en: "North", adj: true },
  דרום: { ar: "الجنوبية", en: "South", adj: true },
  מזרח: { ar: "الشرقية", en: "East", adj: true },
  מערב: { ar: "الغربية", en: "West", adj: true },
  עיר: { ar: "البلد", en: "City", adj: true },
  עילית: { ar: "العليا", en: "Upper", adj: true, enBefore: true },
  תחתית: { ar: "السفلى", en: "Lower", adj: true, enBefore: true },
  חדשה: { ar: "الجديدة", en: "New", adj: true, enBefore: true },
  ישנה: { ar: "القديمة", en: "Old", adj: true, enBefore: true },
  ראשי: { ar: "الرئيسي", en: "Main", adj: true, enBefore: true },
  מרכזי: { ar: "المركزي", en: "Central", adj: true, enBefore: true },
  עסקים: { ar: "أعمال", en: "Business", adj: true, enBefore: true },
  "עסקים גדולים": { ar: "شركات كبيرة", en: "Corporate", adj: true, enBefore: true },
  קניות: { ar: "تسوق", en: "Shopping", adj: true, enBefore: true },
};

const LATIN = {
  א: "a",
  ב: "v",
  ג: "g",
  ד: "d",
  ה: "h",
  ו: "o",
  ז: "z",
  ח: "h",
  ט: "t",
  י: "i",
  כ: "kh",
  ך: "kh",
  ל: "l",
  מ: "m",
  ם: "m",
  נ: "n",
  ן: "n",
  ס: "s",
  ע: "a",
  פ: "f",
  ף: "f",
  צ: "tz",
  ץ: "tz",
  ק: "k",
  ר: "r",
  ש: "sh",
  ת: "t",
};
const LATIN_START = { ב: "b", כ: "k", פ: "p", ו: "v", י: "y" };
const LATIN_GERESH = { ג: "j", ז: "zh", צ: "ch", ץ: "ch", ח: "kh", ת: "th", ד: "dh" };
const VOWELS = new Set(["א", "ו", "י", "ע"]);

const ARABIC = {
  א: "ا",
  ב: "ب",
  ג: "ج",
  ד: "د",
  ה: "ه",
  ו: "و",
  ז: "ز",
  ח: "ح",
  ט: "ط",
  י: "ي",
  כ: "ك",
  ך: "ك",
  ל: "ل",
  מ: "م",
  ם: "م",
  נ: "ن",
  ן: "ن",
  ס: "س",
  ע: "ع",
  פ: "ف",
  ף: "ف",
  צ: "تس",
  ץ: "تس",
  ק: "ك",
  ר: "ر",
  ש: "ش",
  ת: "ت",
};
const ARABIC_START = { פ: "ب" };
const ARABIC_GERESH = { ג: "ج", ז: "ج", צ: "تش", ץ: "تش", ח: "خ", ת: "ث", ד: "ذ" };

const GERESH = /['׳`’]/;

/** One Hebrew word in Latin letters: consonants mapped, vav and yod read as vowels inside. */
export function latinWord(word) {
  const letters = [...word];
  let out = "";
  let prevConsonant = false;
  for (let i = 0; i < letters.length; i++) {
    const c = letters[i];
    if (GERESH.test(c) || c === '"' || c === "״") continue;
    if (!/[א-ת]/.test(c)) {
      out += c;
      prevConsonant = false;
      continue;
    }
    const geresh = GERESH.test(letters[i + 1] ?? "");
    const doubled = (c === "ו" || c === "י") && letters[i + 1] === c;
    // A leading alef or ayin before a vowel letter is silent in Latin: "אורלי" is Orli.
    if (
      i === 0 &&
      (c === "א" || c === "ע") &&
      /[וי]/.test(letters[1] ?? "") &&
      letters[2] !== letters[1]
    )
      continue;
    // The article ה before a word reads "Ha": "הזית" is Hazit.
    if (i === 0 && c === "ה" && letters.length > 2 && !VOWELS.has(letters[1])) {
      out += "ha";
      prevConsonant = false;
      continue;
    }
    let s;
    if (geresh && LATIN_GERESH[c]) s = LATIN_GERESH[c];
    else if (doubled) {
      s = c === "ו" ? "v" : "y";
      i++;
    } else if (i === 0 && LATIN_START[c]) s = LATIN_START[c];
    else if (c === "ה" && i === letters.length - 1) s = "a";
    else s = LATIN[c];
    const final = c === "ה" && i === letters.length - 1 && i > 0;
    const consonant =
      !final && (!VOWELS.has(c) || doubled || (i === 0 && (c === "ו" || c === "י")));
    // Two consonants in a row take an "a" between them, unless a vowel letter follows the second.
    const next = letters[i + 1] ?? "";
    const vowelNext = /[וי]/.test(next) || (next === "ה" && i + 1 === letters.length - 1);
    if (consonant && prevConsonant && !vowelNext) out += "a";
    out += s;
    prevConsonant = consonant;
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** One Hebrew word in Arabic letters, letter by letter (Hebrew and Arabic spell alike). */
export function arabicWord(word) {
  const letters = [...word];
  let out = "";
  for (let i = 0; i < letters.length; i++) {
    const c = letters[i];
    if (GERESH.test(c) || c === '"' || c === "״") continue;
    if (!/[א-ת]/.test(c)) {
      out += c;
      continue;
    }
    const geresh = GERESH.test(letters[i + 1] ?? "");
    if (c === "ו" && letters[i + 1] === "ו") {
      out += "ف";
      i++;
    } else if (c === "י" && letters[i + 1] === "י") {
      out += "ي";
      i++;
    } else if (geresh && ARABIC_GERESH[c]) out += ARABIC_GERESH[c];
    else if (i === 0 && ARABIC_START[c]) out += ARABIC_START[c];
    else if (c === "ה" && i === letters.length - 1 && i > 0) out += "ا";
    else out += ARABIC[c];
  }
  return out;
}

/**
 * A registered business name without its legal tail: no בע"מ, no company number, no
 * parentheses that only hold them ("בי-זול (זכיין הפעלה - בי זול בע"מ - ח.פ. 516690195)").
 */
export function tradeName(he) {
  return plainDashes(he)
    .replace(/\([^)]*(בע"מ|ח\.פ|\d{6,})[^)]*\)?/g, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/(^|\s)(בע"מ|בע״מ|בע מ|בעמ)(?=\s|$)/g, " ")
    .replace(/ח\.פ\.?\s*\d+/g, " ")
    .replace(/(^|\s)מע(''|")מ(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s-]+|[\s-]+$/g, "")
    .trim();
}

/** No en or em dashes and no maqaf in anything Darb writes: a plain hyphen instead. */
export const plainDashes = (s) =>
  String(s)
    .replace(/[־‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (he) =>
  plainDashes(he)
    .replace(/[(),]/g, " ")
    .replace(/\s*-\s*/g, " ")
    .split(" ")
    .filter(Boolean);

/** Short forms the sources use, written out before naming. */
const EXPAND = [
  [/(^|\s)ק\.\s*/g, "$1קרית "],
  [/(^|\s)א\.ת\.?(?=\s|$)/g, "$1אזור תעשייה"],
  [/(^|\s)א"ת(?=\s|$)/g, "$1אזור תעשייה"],
  [/(^|\s)מ\.א\.?\s*/g, "$1מועצה אזורית "],
];
/** A place's own spellings: as is, without its parentheses, and what the parentheses hold. */
const ownVariants = (he) => {
  const out = [normalize(he), normalize(he.replace(/\([^)]*\)/g, " "))];
  for (const m of he.matchAll(/\(([^)]*)\)/g))
    if (!SETTLEMENT_KINDS.test(m[1].trim())) out.push(normalize(m[1]));
  return [...new Set(out.filter(Boolean))];
};
/** Parentheses that say what a place is ("(קיבוץ)", "(מושבה)"), not another name for it. */
const SETTLEMENT_KINDS = /^(קיבוץ|מושב|מושבה|כפר|ישוב|יישוב|שבט|שיכון)(\s|$)/;
const noParens = (s) => s.replace(/\s*\([^)]*\)\s*/g, " ").trim();
/** Letters Arabic in the north never uses, from a few names in places.json. */
const arabicLetters = (s) => s.replace(/پ/g, "ب").replace(/چ/g, "ج").replace(/ڤ/g, "ف");

/**
 * createNamer(places).name(he) → { he, ar, en }. A name that is a Darb place's name (written any
 * of the ways places.mjs accepts) is that place's own Arabic and English. Otherwise place names
 * inside the text (longest first) take the place's names, known words are translated and the
 * rest is transliterated.
 */
export function createNamer(places = loadDarbPlaces(), { extraWords = {} } = {}) {
  const placeNames = new Map();
  const whole = new Map();
  const settlements = places.filter(
    (p) =>
      ["city", "town", "village", "neighbourhood"].includes(p.type) &&
      p.name.he &&
      p.name.ar &&
      p.name.en,
  );
  // Parts of hyphenated names first, so a place's own name overwrites a part of another's.
  for (const p of settlements) {
    const parts = p.name.he.split(/\s*[-\u05BE]\s*/);
    if (parts.length < 2) continue;
    for (const part of parts)
      for (const v of variants(part))
        if (v.length >= 3 && !placeNames.has(v))
          placeNames.set(v, { ar: arabicPhrase(part), en: latinPhrase(part), part: true });
  }
  const looseCount = new Map();
  for (const p of settlements) {
    const own = { ar: noParens(p.name.ar), en: noParens(p.name.en) };
    for (const v of ownVariants(p.name.he)) {
      placeNames.set(v, own);
      const key = loose(v);
      whole.set(key, own);
      looseCount.set(key, (looseCount.get(key) ?? 0) + 1);
    }
  }
  /** A whole-name match: exact, else loose when the loose key is long and names one place. */
  const wholePlace = (he) => {
    const exact = placeNames.get(normalize(he));
    if (exact && !exact.part) return exact;
    const key = loose(he);
    return key.length >= 4 && looseCount.get(key) === 1 ? whole.get(key) : undefined;
  };
  const words = new Map(
    Object.entries({ ...WORDS, ...extraWords }).map(([he, w]) => [normalize(he), w]),
  );
  const MAX_SPAN = 4;
  const done = (he, ar, en) => ({
    he,
    ar: plainDashes(arabicLetters(ar)),
    en: plainDashes(en),
  });

  /** `near`, the record's own Darb place, wins when the name is that place's name. */
  function name(source, near) {
    let he = plainDashes(source);
    for (const [re, to] of EXPAND) he = he.replace(re, to);
    he = he.replace(/\s+/g, " ").trim();
    if (near?.name?.he && ownVariants(near.name.he).some((v) => loose(v) === loose(he)))
      return done(plainDashes(source), noParens(near.name.ar), noParens(near.name.en));
    const place = wholePlace(he);
    if (place) return done(plainDashes(source), place.ar, place.en);
    const tokens = tokenize(he);
    const parts = [];
    for (let i = 0; i < tokens.length;) {
      let hit = null;
      for (let n = Math.min(MAX_SPAN, tokens.length - i); n >= 1 && !hit; n--) {
        const key = normalize(tokens.slice(i, i + n).join(" "));
        const word = words.get(key);
        if (word) hit = { n, kind: "word", ...word };
        else if (placeNames.has(key)) hit = { n, kind: "place", ...placeNames.get(key) };
      }
      if (!hit) {
        const t = tokens[i];
        hit = /[\u05D0-\u05EA]/.test(t)
          ? { n: 1, kind: "text", ar: arabicWord(t), en: latinWord(t) }
          : { n: 1, kind: "text", ar: t, en: t };
      }
      parts.push(hit);
      i += hit.n;
    }
    const ar = parts.map((p) => p.ar).join(" ");
    const isTail = (p) => p.kind === "word" && (p.after || p.adj) && !p.enBefore;
    const before = parts.filter((p) => p.kind === "word" && p.enBefore);
    const head = parts.filter((p) => !isTail(p) && !before.includes(p));
    const en = [...before, ...head, ...parts.filter(isTail)].map((p) => p.en).join(" ");
    return done(plainDashes(source), ar, en);
  }

  /** Whether a text is just a Darb place's name. */
  const isPlace = (he) => Boolean(wholePlace(plainDashes(he)));

  return { name, isPlace };
}

/** A whole Hebrew phrase in Latin letters, word by word. */
export function latinPhrase(he) {
  return tokenize(he)
    .map((t) => (/[א-ת]/.test(t) ? latinWord(t) : t))
    .join(" ");
}
/** A whole Hebrew phrase in Arabic letters, word by word. */
export function arabicPhrase(he) {
  return tokenize(he)
    .map((t) => (/[א-ת]/.test(t) ? arabicWord(t) : t))
    .join(" ");
}
