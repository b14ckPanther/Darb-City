// Arabic names into Hebrew and Latin letters, deterministic and offline, for OSM features named
// only in Arabic (names.mjs goes the other way). Letter by letter: Hebrew writes Arabic names
// the way the north reads them on signs ("أبو" is "אבו", "ج" is "ג'"), never a translation.

const HEBREW = {
  ا: "א",
  أ: "א",
  إ: "א",
  آ: "א",
  ء: "א",
  ئ: "א",
  ؤ: "ו",
  ب: "ב",
  ت: "ת",
  ث: "ת'",
  ج: "ג'",
  ح: "ח",
  خ: "ח'",
  د: "ד",
  ذ: "ד'",
  ر: "ר",
  ز: "ז",
  س: "ס",
  ش: "ש",
  ص: "צ",
  ض: "צ'",
  ط: "ט",
  ظ: "ט'",
  ع: "ע",
  غ: "ע'",
  ف: "פ",
  ق: "ק",
  ك: "כ",
  ل: "ל",
  م: "מ",
  ن: "נ",
  ه: "ה",
  ة: "ה",
  و: "ו",
  ي: "י",
  ى: "א",
  پ: "פ",
  چ: "צ'",
};
const FINAL = { כ: "ך", מ: "ם", נ: "ן", פ: "ף", צ: "ץ" };

const LATIN = {
  ا: "a",
  أ: "a",
  إ: "i",
  آ: "a",
  ء: "",
  ئ: "",
  ؤ: "",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  ة: "a",
  و: "w",
  ي: "y",
  ى: "a",
  پ: "p",
  چ: "ch",
};

/** Common words in Arabic business names, with how Hebrew and English write them. */
const WORDS = {
  أبو: ["אבו", "Abu"],
  ابو: ["אבו", "Abu"],
  محمد: ["מוחמד", "Mohammad"],
  أحمد: ["אחמד", "Ahmad"],
  احمد: ["אחמד", "Ahmad"],
  مسجد: ["מסגד", "Mosque"],
  جامع: ["מסגד", "Mosque"],
  كنيسة: ["כנסיית", "Church"],
  مركز: ["מרכז", "Centre"],
  صيدلية: ["בית מרקחת", "Pharmacy"],
  مدرسة: ["בית ספר", "School"],
  روضة: ["גן", "Kindergarten"],
  عيادة: ["מרפאת", "Clinic"],
  قاعة: ["אולם", "Hall"],
  قاعات: ["אולמי", "Halls"],
  صالون: ["סלון", "Salon"],
  شركة: ["חברת", "Company"],
  جمعية: ["עמותת", "Association"],
  نادي: ["מועדון", "Club"],
  بلدية: ["עיריית", "Municipality"],
  مجلس: ["מועצת", "Council"],
  محلي: ["מקומית", "Local"],
  عبد: ["עבד", "Abd"],
  ابن: ["אבן", "Ibn"],
  // The crescent, never the other word its letters could be read as.
  هلال: ["הלאל", "Hilal"],
  الهلال: ["אל-הלאל", "Al-Hilal"],
  بن: ["בן", "bin"],
  الله: ["אללה", "Allah"],
  و: ["ו", "and"],
};

const isArabicLetter = (c) => /[ء-يپچ]/.test(c);
const HARAKAT = /[ً-ٰٟـ]/g;

function hebrewWord(word) {
  // The article "ال" is written "אל-", as on northern signs.
  if (word.startsWith("ال") && word.length > 3) return `אל-${hebrewWord(word.slice(2))}`;
  let out = "";
  const letters = [...word];
  for (let i = 0; i < letters.length; i++) {
    const c = letters[i];
    if (!isArabicLetter(c)) {
      out += c;
      continue;
    }
    out += HEBREW[c] ?? "";
  }
  return out.replace(/([כמנפצ])('?)$/u, (m, l, g) => (g ? m : FINAL[l]));
}

function latinWord(word) {
  let w = word;
  let prefix = "";
  if (w.startsWith("ال") && w.length > 3) {
    prefix = "Al-";
    w = w.slice(2);
  }
  let out = "";
  const letters = [...w];
  for (let i = 0; i < letters.length; i++) {
    const c = letters[i];
    if (!isArabicLetter(c)) {
      out += c;
      continue;
    }
    let s = LATIN[c] ?? "";
    // Long vowels read as vowels between consonants.
    if (c === "و" && i > 0 && i < letters.length - 1) s = "o";
    if (c === "ي" && i > 0) s = i === letters.length - 1 ? "i" : "ee";
    if (c === "ا" && i > 0) s = "a";
    const prev = out.at(-1) ?? "";
    // Two consonants in a row take an "a" between them.
    if (s && !/[aeiou]/.test(s[0]) && prev && !/[aeiou-]/i.test(prev) && i > 0) out += "a";
    out += s;
  }
  out = out.replace(/ee$/, "i");
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return prefix ? `${prefix}${cap(out)}` : cap(out);
}

/** An Arabic name in Hebrew letters and Latin letters: { he, en }. */
export function fromArabic(ar) {
  const words = String(ar).replace(HARAKAT, "").trim().split(/\s+/).filter(Boolean);
  const he = [];
  const en = [];
  for (const w of words) {
    const known = WORDS[w];
    if (known) {
      he.push(known[0]);
      en.push(known[1]);
    } else if ([...w].some(isArabicLetter)) {
      he.push(hebrewWord(w));
      en.push(latinWord(w));
    } else {
      he.push(w);
      en.push(w);
    }
  }
  return { he: he.join(" "), en: en.join(" ") };
}

export const hasHebrew = (s) => /[א-ת]/.test(s ?? "");
export const hasArabic = (s) => /[ء-ي]/.test(s ?? "");
