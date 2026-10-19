import type { Locale } from "@darb/core";

/**
 * The business card's own words. Kept here rather than in @darb/i18n, whose messages ship to every
 * page's browser code: these reach the browser only on the card's pages, one language at a time
 * (passed as props). Templates keep {time}, {n} and {total} for the card to fill.
 */
export interface CardCopy {
  openUntil: string;
  opensAt: string;
  opensTomorrow: string;
  closedToday: string;
  openAllDay: string;
  today: string;
  waze: string;
  maps: string;
  /** The round button to the business's Google Maps page (its reviews there). */
  googleReviews: string;
  app: string;
  address: string;
  contactWays: string;
  socialPages: string;
  photos: string;
  photoCount: string;
  openPhoto: string;
  previousPhoto: string;
  nextPhoto: string;
  email: string;
  booking: string;
  order: string;
  wolt: string;
  tenbis: string;
  phone2: string;
  /** The round button that opens the rest when there are many. */
  more: string;
  moreWays: string;
}

export const card: Record<Locale, CardCopy> = {
  he: {
    openUntil: "פתוח עד {time}",
    opensAt: "נפתח בשעה {time}",
    opensTomorrow: "נפתח מחר בשעה {time}",
    closedToday: "סגור היום",
    openAllDay: "פתוח 24 שעות",
    today: "היום",
    waze: "ווייז",
    maps: "מפות",
    googleReviews: "ביקורות בגוגל",
    app: "אפליקציה",
    address: "כתובת",
    contactWays: "דרכים ליצירת קשר",
    socialPages: "ברשתות החברתיות",
    photos: "תמונות",
    photoCount: "תמונה {n} מתוך {total}",
    openPhoto: "פתיחת תמונה {n}",
    previousPhoto: "התמונה הקודמת",
    nextPhoto: "התמונה הבאה",
    email: "אימייל",
    booking: "הזמנת תור",
    order: "הזמנה",
    wolt: "וולט",
    tenbis: "תן ביס",
    phone2: "טלפון נוסף",
    more: "עוד",
    moreWays: "עוד דרכים ליצירת קשר",
  },
  ar: {
    openUntil: "فاتح للساعة {time}",
    opensAt: "بيفتح الساعة {time}",
    opensTomorrow: "بيفتح بكرا الساعة {time}",
    closedToday: "مسكّر اليوم",
    openAllDay: "فاتح 24 ساعة",
    today: "اليوم",
    waze: "ويز",
    maps: "خرائط",
    googleReviews: "تقييمات بجوجل",
    app: "التطبيق",
    address: "العنوان",
    contactWays: "كيف توصلهم",
    socialPages: "عالسوشيال ميديا",
    photos: "صور",
    photoCount: "صورة {n} من {total}",
    openPhoto: "افتح صورة {n}",
    previousPhoto: "الصورة اللي قبل",
    nextPhoto: "الصورة اللي بعد",
    email: "إيميل",
    booking: "حجز دور",
    order: "اطلب",
    wolt: "وولت",
    tenbis: "تن بيس",
    phone2: "تلفون تاني",
    more: "كمان",
    moreWays: "طرق تواصل كمان",
  },
  en: {
    openUntil: "Open until {time}",
    opensAt: "Opens at {time}",
    opensTomorrow: "Opens tomorrow at {time}",
    closedToday: "Closed today",
    openAllDay: "Open 24 hours",
    today: "Today",
    waze: "Waze",
    maps: "Maps",
    googleReviews: "Google reviews",
    app: "App",
    address: "Address",
    contactWays: "Ways to reach them",
    socialPages: "On social media",
    photos: "Photos",
    photoCount: "Photo {n} of {total}",
    openPhoto: "Open photo {n}",
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
    email: "Email",
    booking: "Book",
    order: "Order",
    wolt: "Wolt",
    tenbis: "10bis",
    phone2: "Other phone",
    more: "More",
    moreWays: "More ways to reach them",
  },
};
