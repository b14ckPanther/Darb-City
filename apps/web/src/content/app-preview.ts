import type { Locale } from "@darb/core";

/**
 * The words around a business's screen: the preview of an app Darb built for it, and the quiet
 * line that tells an owner their business could have one. "{name}" is the business's name.
 */
export interface AppPreviewCopy {
  eyebrow: string;
  open: string;
  live: string;
  frameTitle: string;
  shotAlt: string;
  owner: { question: string; body: string; cta: string };
}

export const appPreview: Record<Locale, AppPreviewCopy> = {
  he: {
    eyebrow: "האפליקציה של העסק, מבית דרב",
    open: "לאפליקציה",
    live: "לנסות כאן",
    frameTitle: "האפליקציה של {name}",
    shotAlt: "האפליקציה של {name} בטלפון",
    owner: {
      question: "העסק הזה שלכם?",
      body: "דרב בונה לו אפליקציה משלו, כמו של העסקים בתצוגה.",
      cta: "לראות איך",
    },
  },
  ar: {
    eyebrow: "تطبيق المصلحة، من درب",
    open: "افتح التطبيق",
    live: "جرّبه هون",
    frameTitle: "تطبيق {name}",
    shotAlt: "تطبيق {name} عالتلفون",
    owner: {
      question: "هاي مصلحتك؟",
      body: "درب بيعملها تطبيق خاص فيها، متل المصالح اللي بالمعرض.",
      cta: "شوف كيف",
    },
  },
  en: {
    eyebrow: "This business's own app, by Darb",
    open: "Open the app",
    live: "Try it here",
    frameTitle: "{name}'s app",
    shotAlt: "{name}'s app on a phone",
    owner: {
      question: "Is this your business?",
      body: "Darb can build it an app of its own, like the ones in the showroom.",
      cta: "See how",
    },
  },
};
