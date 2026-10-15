import type { Locale } from "@darb/core";

export interface NavCopy {
  label: string;
  menu: string;
  close: string;
  home: string;
  city: string;
  showroom: string;
  pricing: string;
  forBusiness: string;
}

export const nav: Record<Locale, NavCopy> = {
  he: {
    label: "ניווט ראשי",
    menu: "פתיחת התפריט",
    close: "סגירת התפריט",
    home: "בית",
    city: "המפה",
    showroom: "תצוגה",
    pricing: "מחירים",
    forBusiness: "לעסקים",
  },
  ar: {
    label: "التنقل الرئيسي",
    menu: "افتح القائمة",
    close: "سكّر القائمة",
    home: "الرئيسية",
    city: "الخريطة",
    showroom: "المعرض",
    pricing: "الأسعار",
    forBusiness: "للمصالح",
  },
  en: {
    label: "Main navigation",
    menu: "Open the menu",
    close: "Close the menu",
    home: "Home",
    city: "Map",
    showroom: "Showroom",
    pricing: "Pricing",
    forBusiness: "For business",
  },
};
