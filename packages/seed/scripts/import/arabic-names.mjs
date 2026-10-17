// Arabic names into Hebrew and Latin letters, offline and letter by letter, for places
// OpenStreetMap names only in Arabic ("فلافل جبالي"). The other way round is names.mjs.

const TASHKEEL = /[ً-ٰٟـ]/g;

const HEBREW = {
  ا: "א",
  أ: "א",
  إ: "א",
  آ: "א",
  ء: "א",
  ئ: "א",
  ؤ: "או",
  ى: "א",
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
  پ: "פ",
  چ: "צ'",
  ڤ: "ו",
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
  ى: "a",
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
  ع: "",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  ة: "a",
  پ: "p",
  چ: "ch",
  ڤ: "v",
};
const ARABIC_LETTER = /[ء-يپچڤ]/;

/** Words, with the article "ال" written apart ("الشيخ" → ["ال", "شيخ"]). */
const words = (ar) =>
  String(ar).replace(TASHKEEL, "").replace(/[،؛]/g, ",").split(/\s+/).filter(Boolean);

/** One Arabic word in Hebrew letters: "شاورما" → "שאורמא", with final forms. */
function hebrewWord(word) {
  let rest = word;
  let prefix = "";
  if (/^ال./.test(rest) && rest.length > 3) {
    prefix = "אל-";
    rest = rest.slice(2);
  }
  let out = "";
  for (const c of rest) out += ARABIC_LETTER.test(c) ? (HEBREW[c] ?? "") : c;
  out = out.replace(/([כמנפצ])('?)$/, (_, l, g) => (g ? l + g : FINAL[l]));
  return prefix + out;
}

/** One Arabic word in Latin letters: vav and yod as vowels inside, "a" between consonants. */
function latinWord(word) {
  let rest = word;
  let prefix = "";
  if (/^ال./.test(rest) && rest.length > 3) {
    prefix = "al-";
    rest = rest.slice(2);
  }
  const letters = [...rest];
  let out = "";
  let prev = false; // last letter written was a consonant
  for (let i = 0; i < letters.length; i++) {
    const c = letters[i];
    if (!ARABIC_LETTER.test(c)) {
      out += c;
      prev = false;
      continue;
    }
    if (c === "و" || c === "ي") {
      const first = i === 0;
      const vowel = !first && prev;
      if (vowel) {
        out += c === "و" ? "u" : "i";
        prev = false;
      } else {
        out += c === "و" ? "w" : "y";
        prev = true;
      }
      continue;
    }
    const s = LATIN[c] ?? "";
    const vowelLetter = /^[aiu]$/.test(s);
    if (!vowelLetter && s && prev) out += "a";
    out += s;
    prev = Boolean(s) && !vowelLetter;
  }
  const w = prefix + out;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** Words places are called by, said rather than spelt ("حمص" is hummus, never "Hamas"). */
export const AR_WORDS = {
  مطعم: { he: "מסעדת", en: "Restaurant" },
  مقهى: { he: "קפה", en: "Cafe" },
  قهوة: { he: "קפה", en: "Coffee" },
  كافيه: { he: "קפה", en: "Cafe" },
  كافي: { he: "קפה", en: "Cafe" },
  حمص: { he: "חומוס", en: "Hummus" },
  فلافل: { he: "פלאפל", en: "Falafel" },
  شاورما: { he: "שווארמה", en: "Shawarma" },
  شاورمة: { he: "שווארמה", en: "Shawarma" },
  مشاوي: { he: "גריל", en: "Grill" },
  مخبز: { he: "מאפיית", en: "Bakery" },
  فرن: { he: "מאפיית", en: "Bakery" },
  افران: { he: "מאפיות", en: "Bakeries" },
  أفران: { he: "מאפיות", en: "Bakeries" },
  حلويات: { he: "ממתקי", en: "Sweets" },
  كنافة: { he: "כנאפה", en: "Knafeh" },
  بوظة: { he: "גלידת", en: "Ice Cream" },
  عصير: { he: "מיצי", en: "Juice" },
  ملحمة: { he: "אטליז", en: "Butcher" },
  ملاحم: { he: "אטליזי", en: "Butchers" },
  بيتزا: { he: "פיצה", en: "Pizza" },
  برغر: { he: "בורגר", en: "Burger" },
  سوشي: { he: "סושי", en: "Sushi" },
  سمك: { he: "דגים", en: "Fish" },
  أبو: { he: "אבו", en: "Abu" },
  ابو: { he: "אבו", en: "Abu" },
  بيت: { he: "בית", en: "Beit" },
  محمص: { he: "קליית", en: "Roastery" },
  محمصة: { he: "קליית", en: "Roastery" },
  و: { he: "ו", en: "and" },
};

const said = (w, to) => AR_WORDS[w]?.[to] ?? null;

/** An Arabic name in Hebrew letters. */
export const hebrewFromArabic = (ar) =>
  words(ar)
    .map((w) => said(w, "he") ?? hebrewWord(w))
    .join(" ")
    .replace(/(^|\s)ו (?=\S)/g, "$1ו");
/** An Arabic name in Latin letters. */
export const latinFromArabic = (ar) =>
  words(ar)
    .map((w) => said(w, "en") ?? latinWord(w))
    .join(" ")
    .replace(/\bAl-(\p{Ll})/gu, (_, c) => `Al-${c.toUpperCase()}`)
    .replace(/\bal-(\p{Ll})/gu, (_, c) => `al-${c.toUpperCase()}`);
