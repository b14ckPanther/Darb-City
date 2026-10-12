import type { Locale, Localized } from "@darb/core";

export interface ForBusinessCopy {
  title: string;
  lead: string;
  points: { title: string; body: string }[];
  clientsTitle: string;
  contactTitle: string;
  contactBody: string;
  email: string;
  instagram: string;
}

export const forBusiness: Record<Locale, ForBusinessCopy> = {
  en: {
    title: "Your business, as an app",
    lead: "Darb builds a web app and a native app for any kind of business, in any town, in Hebrew, Arabic and English.",
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
        body: "On the App Store and Google Play, with your name, your colours and your language.",
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
    lead: "דרב בונה אפליקציית ווב ואפליקציה נייטיב לכל סוג עסק, בכל יישוב, בעברית, בערבית ובאנגלית.",
    points: [
      {
        title: "כל סוג של עסק",
        body: "מסעדות, מספרות, מוסכים, מרפאות, חנויות, מסגדים ועוד מאתיים סוגים. כל דלת בעיר הזו מראה מה אנחנו בונים.",
      },
      {
        title: "אפליקציית ווב",
        body: "מהירה, ניתנת להתקנה וקלה למציאה. הזמנות, תורים ושאלות מגיעים ישר אליכם.",
      },
      { title: "אפליקציה נייטיב", body: "ב-App Store וב-Google Play, עם השם, הצבעים והשפה שלכם." },
    ],
    clientsTitle: "עבודות חיות של לקוחות",
    contactTitle: "דברו איתנו",
    contactBody: "ספרו לנו על העסק ומה הלקוחות שלכם צריכים לעשות בו.",
    email: "אימייל",
    instagram: "אינסטגרם",
  },
  ar: {
    title: "مصلحتك، كتطبيق",
    lead: "درب تبني تطبيق ويب وتطبيقًا أصليًا لأي نوع من المصالح، في أي بلدة، بالعربية والعبرية والإنجليزية.",
    points: [
      {
        title: "أي نوع من المصالح",
        body: "مطاعم، صالونات، كراجات، عيادات، محلات، مساجد ومئتا نوع آخر. كل باب في هذه المدينة يُريك ما نبنيه.",
      },
      {
        title: "تطبيق ويب",
        body: "سريع، قابل للتثبيت وسهل الإيجاد. الطلبات والحجوزات والأسئلة تصلك مباشرة.",
      },
      { title: "تطبيق أصلي", body: "على App Store وGoogle Play، باسمك وألوانك ولغتك." },
    ],
    clientsTitle: "أعمال منشورة لزبائننا",
    contactTitle: "تحدّث معنا",
    contactBody: "أخبرنا عن مصلحتك وماذا يجب أن يستطيع زبائنك فعله.",
    email: "البريد الإلكتروني",
    instagram: "إنستغرام",
  },
};

export const LIVE_CLIENTS: { name: Localized; kind: Localized; url: string }[] = [
  {
    name: { he: "קרמל", ar: "كراميل", en: "Caramel" },
    kind: { he: "מסעדה", ar: "مطعم", en: "Restaurant" },
    url: "https://caramel.darb.co.il",
  },
  {
    name: { he: "רגד", ar: "رغد", en: "Raghad" },
    kind: { he: "חנות", ar: "متجر", en: "Shop" },
    url: "https://raghad.darb.co.il",
  },
  {
    name: { he: "פז", ar: "باز", en: "Paz" },
    kind: { he: "תחנות דלק", ar: "محطات وقود", en: "Fuel stations" },
    url: "https://paz.darb.co.il",
  },
];

export const CONTACT = {
  email: "founder@darb.co.il",
  instagram: "https://www.instagram.com/darbco/",
};
