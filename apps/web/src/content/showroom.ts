import type { Locale } from "@darb/core";

/** One live client build, shown running in the showroom's devices. */
export interface ShowroomClient {
  /** The anchor id (/showroom#caramel) and React key. */
  id: string;
  url: string;
  name: string;
  kind: string;
  body: string;
  highlights: string[];
}

export interface ShowroomCopy {
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  lead: string;
  live: string;
  open: string;
  devices: { laptop: string; tablet: string; phone: string };
  frameTitle: string;
  clients: ShowroomClient[];
  cta: { title: string; body: string; talk: string; pricing: string };
}

const URLS = {
  caramel: "https://caramel.darb.co.il",
  raghad: "https://raghad.darb.co.il",
  paz: "https://paz.darb.co.il",
};

export const showroom: Record<Locale, ShowroomCopy> = {
  he: {
    title: "התצוגה | דרב",
    description: "אפליקציות שדרב בנה לעסקים אמיתיים, חיות, בטלפון, בטאבלט ובמחשב.",
    eyebrow: "התצוגה",
    heading: "לא צילומי מסך. אפליקציות חיות.",
    lead: "כל מה שתראו כאן רץ עכשיו, באמת. גללו, לחצו, נסו. כל אחת מהן נבנתה מאפס לעסק אחד.",
    live: "חי עכשיו",
    open: "לפתוח באתר",
    devices: { laptop: "מחשב", tablet: "טאבלט", phone: "טלפון" },
    frameTitle: "{name} בתצוגה חיה",
    clients: [
      {
        id: "caramel",
        url: URLS.caramel,
        name: "קרמל",
        kind: "קונדיטוריה ומסעדה ללא גלוטן · עכו",
        body: "גן עדן לצליאקים. תפריט שמרגיש כמו לטייל בתוך הוויטרינה, עם מחירים, שעות ודרכי הגעה.",
        highlights: ["תפריט חי ומעוצב", "רב-לשוני", "מותאם לטלפון"],
      },
      {
        id: "raghad",
        url: URLS.raghad,
        name: "רגד ביוטי",
        kind: "מוצרי טיפוח לשיער · נחף",
        body: "חנות ששמה את המוצר במרכז: קרמים ומסכות סקאלה, עם הזמנה ומשלוח לאזור הצפון.",
        highlights: ["קטלוג מוצרים", "הזמנה בקליק", "בתיאום מראש"],
      },
      {
        id: "paz",
        url: URLS.paz,
        name: "פז | YellowShifts",
        kind: "תחנות דלק · קריית אתא וקריית מוצקין",
        body: "לא רק אתר: מערכת שלמה לניהול משמרות ועובדים בתחנות, מסונכרנת בזמן אמת.",
        highlights: ["ניהול משמרות", "מנהלים ועובדים", "סנכרון בזמן אמת"],
      },
    ],
    cta: {
      title: "העסק הבא בתצוגה יכול להיות שלכם.",
      body: "ספרו לנו מה אתם עושים. נבנה משהו שאין לאף אחד אחר.",
      talk: "לדבר איתנו",
      pricing: "לראות את התוכניות",
    },
  },
  ar: {
    title: "المعرض | درب",
    description: "تطبيقات عملها درب لمصالح حقيقية، لايف، عالتلفون والتابلت والكمبيوتر.",
    eyebrow: "المعرض",
    heading: "مش صور شاشة. تطبيقات لايف.",
    lead: "كل إشي هون شغّال لايف، عن جد. انزل، اكبس، جرّب. كل واحد فيهم انعمل من الصفر لمصلحة وحدة.",
    live: "لايف",
    open: "افتح الموقع",
    devices: { laptop: "كمبيوتر", tablet: "تابلت", phone: "تلفون" },
    frameTitle: "{name} لايف",
    clients: [
      {
        id: "caramel",
        url: URLS.caramel,
        name: "كراميل",
        kind: "حلويات ومطعم بلا غلوتين · عكا",
        body: "جنة لأصحاب السيلياك. منيو بتحسها متل ما تكون ماشي جوّا الفترينة، مع الأسعار والدوام وكيف توصل.",
        highlights: ["منيو لايف ومصمّم", "بكل اللغات", "مزبوط عالتلفون"],
      },
      {
        id: "raghad",
        url: URLS.raghad,
        name: "رغد بيوتي",
        kind: "منتجات للشعر · نحف",
        body: "محل بحط المنتج بالنص: كريمات وماسكات سكالا، مع طلب وتوصيل لكل الشمال.",
        highlights: ["كتالوج منتجات", "طلب بكبسة", "بموعد مسبق"],
      },
      {
        id: "paz",
        url: URLS.paz,
        name: "باز | YellowShifts",
        kind: "محطات بنزين · كريات آتا وكريات موتسكين",
        body: "مش بس موقع: سيستم كامل لترتيب الشفتات والعمّال بالمحطات، متزامن لايف.",
        highlights: ["ترتيب شفتات", "مدراء وعمّال", "تزامن لايف"],
      },
    ],
    cta: {
      title: "المصلحة الجاي بالمعرض ممكن تكون إلك.",
      body: "احكيلنا شو بتشتغل. منعملك إشي ما حدا عنده متله.",
      talk: "احكي معنا",
      pricing: "شوف الخطط",
    },
  },
  en: {
    title: "Showroom | Darb",
    description: "Apps Darb built for real businesses, live, on a phone, a tablet and a laptop.",
    eyebrow: "Showroom",
    heading: "Not screenshots. Live apps.",
    lead: "Everything here is running right now, for real. Scroll, tap, try it. Each one was built from zero for one business.",
    live: "Live now",
    open: "Open the site",
    devices: { laptop: "Laptop", tablet: "Tablet", phone: "Phone" },
    frameTitle: "{name}, live preview",
    clients: [
      {
        id: "caramel",
        url: URLS.caramel,
        name: "Caramel",
        kind: "Gluten-free patisserie and restaurant · Akko",
        body: "A celiac's paradise. A menu that feels like walking through the display case, with prices, hours and directions.",
        highlights: ["Living, designed menu", "Multilingual", "Made for phones"],
      },
      {
        id: "raghad",
        url: URLS.raghad,
        name: "Raghad Beauty",
        kind: "Hair care products · Nahf",
        body: "A shop that puts the product first: Scala creams and masks, with ordering and delivery across the north.",
        highlights: ["Product catalogue", "One-tap ordering", "By appointment"],
      },
      {
        id: "paz",
        url: URLS.paz,
        name: "Paz | YellowShifts",
        kind: "Fuel stations · Kiryat Ata and Kiryat Motzkin",
        body: "More than a website: a whole shift and staff platform for the stations, synced in real time.",
        highlights: ["Shift management", "Managers and staff", "Real-time sync"],
      },
    ],
    cta: {
      title: "The next business in this showroom could be yours.",
      body: "Tell us what you do. We'll build something nobody else has.",
      talk: "Talk to us",
      pricing: "See the plans",
    },
  },
};
