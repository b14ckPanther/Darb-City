import type { Locale } from "@darb/core";

/** Darb's channels and the founder's, as shown on zangeel.dev. */
export const SOCIAL = {
  darbInstagram: { href: "https://www.instagram.com/darbco/", handle: "@darbco" },
  email: { href: "mailto:founder@darb.co.il", handle: "founder@darb.co.il" },
  portfolio: { href: "https://zangeel.dev", handle: "zangeel.dev" },
  founderInstagram: { href: "https://www.instagram.com/noormosa.97/", handle: "@noormosa.97" },
  linkedin: { href: "https://www.linkedin.com/in/nmprofessor/", handle: "LinkedIn" },
  github: { href: "https://github.com/b14ckPanther", handle: "GitHub" },
} as const;

export interface FooterCopy {
  motto: string;
  cta: string;
  exploreTitle: string;
  darbTitle: string;
  founderTitle: string;
  links: { explore: string; search: string; showroom: string; pricing: string };
  rights: string;
  languages: string;
  legal: { accessibility: string; terms: string; privacy: string };
}

export const footer: Record<Locale, FooterCopy> = {
  he: {
    motto: "כל סוג של עסק. כל עיר וכל כפר. דרך אחת.",
    cta: "יש לכם עסק? בואו נדבר",
    exploreTitle: "לגלות",
    darbTitle: "דרב",
    founderTitle: "המייסד",
    links: { explore: "העיר", search: "חיפוש", showroom: "תצוגה", pricing: "תוכניות ומחירים" },
    rights: "כל הזכויות שמורות",
    languages: "שפה",
    legal: { accessibility: "הצהרת נגישות", terms: "תנאי שימוש", privacy: "מדיניות פרטיות" },
  },
  ar: {
    motto: "كل أنواع المصالح. كل مدينة وقرية. درب واحد.",
    cta: "عندك مصلحة؟ لنتحدث",
    exploreTitle: "اكتشف",
    darbTitle: "درب",
    founderTitle: "المؤسس",
    links: { explore: "المدينة", search: "بحث", showroom: "المعرض", pricing: "الخطط والأسعار" },
    rights: "جميع الحقوق محفوظة",
    languages: "اللغة",
    legal: {
      accessibility: "بيان إتاحة الوصول",
      terms: "شروط الاستخدام",
      privacy: "سياسة الخصوصية",
    },
  },
  en: {
    motto: "Every kind of business. Every town and village. One path.",
    cta: "Own a business? Let's talk",
    exploreTitle: "Explore",
    darbTitle: "Darb",
    founderTitle: "Founder",
    links: {
      explore: "The city",
      search: "Search",
      showroom: "Showroom",
      pricing: "Plans & pricing",
    },
    rights: "All rights reserved",
    languages: "Language",
    legal: {
      accessibility: "Accessibility statement",
      terms: "Terms of use",
      privacy: "Privacy policy",
    },
  },
};
