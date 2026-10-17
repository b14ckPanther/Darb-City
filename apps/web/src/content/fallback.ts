import type { Locale } from "@darb/core";

/**
 * The few words the error and not-found views need, held here so those always-loaded client views
 * do not pull the whole message table into every page. A test keeps them equal to @darb/i18n.
 */
export const FALLBACK_TEXT: Record<
  Locale,
  Record<
    "notFoundTitle" | "notFoundBody" | "didYouMean" | "backToCity" | "unreachable" | "retry",
    string
  >
> = {
  he: {
    notFoundTitle: "הדרך הזו עוד לא מובילה לשום מקום",
    notFoundBody: "ייתכן שהמקום, סוג העסק או העסק עברו.",
    didYouMean: "התכוונתם ל-{name}?",
    backToCity: "חזרה לעיר",
    unreachable: "אין חיבור לדרב כרגע.",
    retry: "לנסות שוב",
  },
  ar: {
    notFoundTitle: "هذا الطريق لا يؤدي إلى أي مكان بعد",
    notFoundBody: "ربما انتقل المكان أو نوع المصلحة أو المصلحة نفسها.",
    didYouMean: "هل تقصد {name}؟",
    backToCity: "العودة إلى المدينة",
    unreachable: "لا يمكن الوصول إلى درب الآن.",
    retry: "حاول مرة أخرى",
  },
  en: {
    notFoundTitle: "This path leads nowhere yet",
    notFoundBody: "The place, kind or business may have moved.",
    didYouMean: "Did you mean {name}?",
    backToCity: "Back to the city",
    unreachable: "Darb can't be reached right now.",
    retry: "Try again",
  },
};
