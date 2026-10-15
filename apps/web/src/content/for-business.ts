import type { Locale, Localized } from "@darb/core";

/** A run of Latin text (a store or brand name) kept in its own order inside RTL copy. */
export interface LatinRun {
  latin: string;
}
/** Plain copy, or copy split so that Latin names render isolated (`<bdi dir="ltr">`). */
export type RichText = string | readonly (string | LatinRun)[];

export function plainText(text: RichText): string {
  return typeof text === "string"
    ? text
    : text.map((part) => (typeof part === "string" ? part : part.latin)).join("");
}

export interface ForBusinessCopy {
  title: string;
  lead: string;
  points: { title: string; body: RichText }[];
  clientsTitle: string;
  contactTitle: string;
  contactBody: string;
  email: string;
  instagram: string;
}

export const forBusiness: Record<Locale, ForBusinessCopy> = {
  en: {
    title: "Your business, as an app",
    lead: "Darb builds a web app and a native app for any kind of business, in any town, in any language.",
    points: [
      {
        title: "Any kind of business",
        body: "Restaurants, salons, garages, clinics, shops, mosques and two hundred more. Every door in this city shows what we build.",
      },
      {
        title: "A web app",
        body: "Fast, installable and easy to find. Orders, bookings and questions reach you directly.",
      },
      {
        title: "A native app",
        body: "We build your native app and publish it for you on the App Store and Google Play, with your name, your colours and your language.",
      },
    ],
    clientsTitle: "Live client work",
    contactTitle: "Talk to us",
    contactBody: "Tell us about your business and what your customers should be able to do.",
    email: "Email",
    instagram: "Instagram",
  },
  he: {
    title: "העסק שלכם, כאפליקציה",
    lead: "דרב בונה אפליקציית ווב ואפליקציה נייטיב לכל סוג עסק, בכל יישוב, בכל שפה.",
    points: [
      {
        title: "כל סוג של עסק",
        body: "מסעדות, מספרות, מוסכים, מרפאות, חנויות, מסגדים ועוד מאתיים סוגים. כל דלת בעיר הזו מראה מה אנחנו בונים.",
      },
      {
        title: "אפליקציית ווב",
        body: "מהירה, ניתנת להתקנה וקלה למציאה. הזמנות, תורים ושאלות מגיעים ישר אליכם.",
      },
      {
        title: "אפליקציה נייטיב",
        body: [
          "אנחנו בונים לכם אפליקציה נייטיב ומפרסמים אותה בשבילכם ב-",
          { latin: "App Store" },
          " וב-",
          { latin: "Google Play" },
          ", עם השם, הצבעים והשפה שלכם.",
        ],
      },
    ],
    clientsTitle: "עבודות חיות של לקוחות",
    contactTitle: "דברו איתנו",
    contactBody: "ספרו לנו על העסק ומה הלקוחות שלכם צריכים לעשות בו.",
    email: "אימייל",
    instagram: "אינסטגרם",
  },
  ar: {
    title: "مصلحتك، كتطبيق",
    lead: "درب تبني تطبيق ويب وتطبيقًا أصليًا لأي نوع من المصالح، في أي بلدة، بأي لغة.",
    points: [
      {
        title: "أي نوع من المصالح",
        body: "مطاعم، صالونات، كراجات، عيادات، محلات، مساجد ومئتا نوع آخر. كل باب في هذه المدينة يُريك ما نبنيه.",
      },
      {
        title: "تطبيق ويب",
        body: "سريع، قابل للتثبيت وسهل الإيجاد. الطلبات والحجوزات والأسئلة تصلك مباشرة.",
      },
      {
        title: "تطبيق أصلي",
        body: [
          "نبني لك تطبيقًا أصليًا وننشره نيابةً عنك على ",
          { latin: "App Store" },
          " و",
          { latin: "Google Play" },
          "، باسمك وألوانك ولغتك.",
        ],
      },
    ],
    clientsTitle: "أعمال منشورة لزبائننا",
    contactTitle: "تحدّث معنا",
    contactBody: "أخبرنا عن مصلحتك وماذا يجب أن يستطيع زبائنك فعله.",
    email: "البريد الإلكتروني",
    instagram: "إنستغرام",
  },
};

/** A client without a url has no public app (Paz's is for its staff only, Task 28). */
export const LIVE_CLIENTS: { name: Localized; kind: Localized; url?: string }[] = [
  {
    name: { he: "קרמל", ar: "كراميل", en: "Caramel" },
    kind: { he: "מסעדה", ar: "مطعم", en: "Restaurant" },
    url: "https://caramel.darb.co.il",
  },
  {
    name: { he: "רגד ביוטי", ar: "رغد بيوتي", en: "Raghad Beauty" },
    kind: { he: "חנות", ar: "متجر", en: "Shop" },
    url: "https://raghad.darb.co.il",
  },
  {
    name: { he: "פז", ar: "باز", en: "Paz" },
    kind: { he: "תחנות דלק", ar: "محطات وقود", en: "Fuel stations" },
  },
];

export const CONTACT = {
  email: "founder@darb.co.il",
  instagram: "https://www.instagram.com/darbco/",
};
