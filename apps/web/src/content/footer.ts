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

export type SocialIcon = "instagram" | "linkedin" | "github" | "email" | "web";

/** The people behind Darb, credited in the footer; each link is an icon with an accessible name. */
export const PEOPLE = [
  {
    id: "noor",
    name: "Noor",
    names: { he: "נור", ar: "نور", en: "Noor" },
    links: [
      { icon: "web", label: "zangeel.dev", href: "https://zangeel.dev" },
      { icon: "instagram", label: "Instagram", href: "https://www.instagram.com/noormosa.97/" },
      { icon: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/nmprofessor/" },
      { icon: "github", label: "GitHub", href: "https://github.com/b14ckPanther" },
    ],
  },
  {
    id: "lama",
    name: "Lama",
    names: { he: "למא", ar: "لمى", en: "Lama" },
    links: [
      {
        icon: "linkedin",
        label: "LinkedIn",
        href: "https://www.linkedin.com/in/lama-zbedat-763165341/",
      },
      { icon: "github", label: "GitHub", href: "https://github.com/lzbedat3" },
    ],
  },
] as const satisfies readonly {
  id: string;
  name: string;
  names: Record<Locale, string>;
  links: readonly { icon: SocialIcon; label: string; href: string }[];
}[];

export interface FooterCopy {
  motto: string;
  cta: string;
  exploreTitle: string;
  darbTitle: string;
  founderTitle: string;
  roles: { noor: string; lama: string };
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
    founderTitle: "האנשים מאחורי דרב",
    roles: { noor: 'מייסד ומנכ"ל', lama: "שותפה מייסדת ו-CPO" },
    links: { explore: "העיר", search: "חיפוש", showroom: "תצוגה", pricing: "תוכניות ומחירים" },
    rights: "כל הזכויות שמורות",
    languages: "שפה",
    legal: { accessibility: "הצהרת נגישות", terms: "תנאי שימוש", privacy: "מדיניות פרטיות" },
  },
  ar: {
    motto: "كل أنواع المصالح. كل بلد وكل قرية. درب واحد.",
    cta: "عندك مصلحة؟ يلا نحكي",
    exploreTitle: "اكتشف",
    darbTitle: "درب",
    founderTitle: "الناس ورا درب",
    roles: { noor: "المؤسس والـ CEO", lama: "شريكة مؤسسة والـ CPO" },
    links: { explore: "البلد", search: "دوّر", showroom: "المعرض", pricing: "الخطط والأسعار" },
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
    founderTitle: "The people behind Darb",
    roles: { noor: "Founder & CEO", lama: "Co-founder & CPO" },
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
