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
    description: "تطبيقات بناها درب لمصالح حقيقية، حيّة، على الهاتف واللوح والحاسوب.",
    eyebrow: "المعرض",
    heading: "ليست صور شاشة. تطبيقات حيّة.",
    lead: "كل ما تراه هنا يعمل الآن فعلاً. مرّر، اضغط، جرّب. كل واحد منها بُني من الصفر لمصلحة واحدة.",
    live: "حيّ الآن",
    open: "افتح الموقع",
    devices: { laptop: "حاسوب", tablet: "لوح", phone: "هاتف" },
    frameTitle: "{name} في عرض حيّ",
    clients: [
      {
        id: "caramel",
        url: URLS.caramel,
        name: "كراميل",
        kind: "حلويات ومطعم خالٍ من الغلوتين · عكا",
        body: "جنّة لمرضى السيلياك. قائمة تشعر وكأنك تتجول داخل الواجهة، مع الأسعار والساعات والطريق.",
        highlights: ["قائمة حيّة ومصمّمة", "متعدد اللغات", "مناسبة للهاتف"],
      },
      {
        id: "raghad",
        url: URLS.raghad,
        name: "رغد بيوتي",
        kind: "منتجات العناية بالشعر · نحف",
        body: "متجر يضع المنتج في المركز: كريمات وماسكات سكالا، مع طلب وتوصيل لمنطقة الشمال.",
        highlights: ["كتالوج منتجات", "طلب بنقرة", "بالتنسيق المسبق"],
      },
      {
        id: "paz",
        url: URLS.paz,
        name: "باز | YellowShifts",
        kind: "محطات وقود · كريات آتا وكريات موتسكين",
        body: "ليس موقعاً فقط: نظام كامل لإدارة الورديات والعاملين في المحطات، متزامن لحظياً.",
        highlights: ["إدارة الورديات", "مدراء وعاملون", "تزامن لحظي"],
      },
    ],
    cta: {
      title: "المصلحة القادمة في المعرض قد تكون مصلحتك.",
      body: "أخبرنا ماذا تعمل. سنبني شيئاً لا يملكه أحد غيرك.",
      talk: "تحدّث معنا",
      pricing: "شاهد الخطط",
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
