import type { Locale } from "@darb/core";

/**
 * Apps Darb built for a chain, shown on that chain's cards: its own stations say Darb built their
 * app, the chain's other stations are invited to have theirs. The app itself opens only in the
 * showroom (/showroom#id), never straight from a card.
 */
export interface ChainApp {
  /** The showroom entry (and its screenshots in /public/showroom). */
  showroom: string;
  name: string;
  ours: { title: string; body: string; open: string };
  invite: { title: string; body: string; open: string; join: string };
}

export const CHAIN_APPS: Record<string, Record<Locale, ChainApp>> = {
  paz: {
    he: {
      showroom: "paz",
      name: "YellowShifts",
      ours: {
        title: "האפליקציה של התחנה, מבית דרב",
        body: "YellowShifts: משמרות, מנהלים ועובדים במקום אחד, מסונכרן בזמן אמת. עיצבנו ובנינו אותה במיוחד לתחנה הזאת.",
        open: "לראות אותה בתצוגה",
      },
      invite: {
        title: "רוצים אפליקציה כזאת לתחנה שלכם?",
        body: "פז קריית אתא ופז כורדני כבר מנהלות את המשמרות שלהן עם YellowShifts, שדרב בנתה. אפשר גם אצלכם.",
        open: "לראות את האפליקציה",
        join: "דברו איתנו",
      },
    },
    ar: {
      showroom: "paz",
      name: "YellowShifts",
      ours: {
        title: "تطبيق المحطة، من درب",
        body: "YellowShifts: الشفتات والمدراء والعمّال بمكان واحد، متزامن لايف. صمّمناه وبنيناه خصيصًا لهالمحطة.",
        open: "شوفه بالمعرض",
      },
      invite: {
        title: "بدك تطبيق متله لمحطتك؟",
        body: "باز كريات آتا وباز كورداني بيرتبوا الشفتات تبعهم مع YellowShifts، اللي بناه درب. فيك تاخد واحد كمان.",
        open: "شوف التطبيق",
        join: "احكي معنا",
      },
    },
    en: {
      showroom: "paz",
      name: "YellowShifts",
      ours: {
        title: "This station's app, by Darb",
        body: "YellowShifts: shifts, managers and staff in one place, synced live. We designed and built it for this station.",
        open: "See it in the showroom",
      },
      invite: {
        title: "Want an app like this for your station?",
        body: "Paz Kiryat Ata and Paz Curdani already run their shifts on YellowShifts, built by Darb. Yours can too.",
        open: "See the app",
        join: "Talk to us",
      },
    },
  },
};
