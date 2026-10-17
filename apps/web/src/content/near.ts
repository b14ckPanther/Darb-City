import type { Locale } from "@darb/core";

/** What the /near page says. Kept out of @darb/i18n so the shared message table stays small. */
export interface NearCopy {
  title: string;
  /** "{place}" becomes the place the visitor is in. */
  titleAt: string;
  lead: string;
  ask: string;
  useMyLocation: string;
  denied: string;
  browsePlaces: string;
  empty: string;
  hereMarker: string;
  map: string;
}

export const near: Record<Locale, NearCopy> = {
  he: {
    title: "קרוב אליכם",
    titleAt: "קרוב אליכם · {place}",
    lead: "העסקים סביב המקום שבו אתם עומדים, הקרובים קודם.",
    ask: "שתפו מיקום פעם אחת ודרב יראה לכם את העסקים הכי קרובים. אנחנו לא שומרים אותו.",
    useMyLocation: "להשתמש במיקום שלי",
    denied: "המיקום כבוי, אז דרב לא יודע איפה אתם. אפשר לעבור לפי מקום.",
    browsePlaces: "לכל המקומות",
    empty: "עוד אין בדרב עסקים קרובים אליכם.",
    hereMarker: "אתם כאן",
    map: "מפת העסקים הקרובים אליכם",
  },
  ar: {
    title: "حواليك",
    titleAt: "حواليك · {place}",
    lead: "المصالح اللي حوالين المكان اللي إنت فيه، الأقرب أول.",
    ask: "شارك موقعك مرة وحدة ودرب بفرجيك أقرب المصالح إلك. ما منحفظه عنا.",
    useMyLocation: "استعمل موقعي",
    denied: "الموقع مسكّر، فدرب ما بعرف وين إنت. فيك تدوّر حسب المكان.",
    browsePlaces: "كل الأماكن",
    empty: "لسا ما في مصالح قريبة منك على درب.",
    hereMarker: "إنت هون",
    map: "خريطة المصالح اللي حواليك",
  },
  en: {
    title: "Near you",
    titleAt: "Near you · {place}",
    lead: "Businesses around where you are standing, the closest first.",
    ask: "Share your location once and Darb shows the businesses closest to you. We never save it.",
    useMyLocation: "Use my location",
    denied: "Location is off, so Darb can't see where you are. You can browse by place instead.",
    browsePlaces: "Browse places",
    empty: "No businesses near you on Darb yet.",
    hereMarker: "You are here",
    map: "Map of businesses near you",
  },
};
