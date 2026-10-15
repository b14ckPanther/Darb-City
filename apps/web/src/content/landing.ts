import type { Locale } from "@darb/core";

/**
 * The landing page's words. The story is the founder's own voice (first person, short, real names);
 * edit it here, not in a component.
 */
export interface LandingCopy {
  title: string;
  description: string;
  hero: {
    eyebrow: string;
    title: string;
    accent: string;
    lead: string;
    explore: string;
    showroom: string;
    scroll: string;
  };
  story: { eyebrow: string; paragraphs: string[]; signature: string; role: string };
  platform: {
    eyebrow: string;
    title: string;
    layers: { title: string; body: string }[];
    without: { label: string; body: string };
    with: { label: string; body: string };
  };
  search: { eyebrow: string; title: string; body: string; examples: string[] };
  made: {
    eyebrow: string;
    title: string;
    body: string;
    open: string;
    clients: { name: string; kind: string; url: string }[];
  };
  join: { title: string; body: string; pricing: string; talk: string };
}

const CLIENT_URLS = {
  caramel: "https://caramel.darb.co.il",
  raghad: "https://raghad.darb.co.il",
  paz: "https://paz.darb.co.il",
};

export const landing: Record<Locale, LandingCopy> = {
  he: {
    title: "דרב | דרך אחת לכל עסק",
    description: "מוצאים כל עסק, כמו שמדברים. ולבעלי עסקים: אפליקציה שנבנתה רק בשבילכם.",
    hero: {
      eyebrow: "דרב · درب · Darb",
      title: "דרך אחת",
      accent: "לכל עסק.",
      lead: "כתבו את זה כמו שהייתם אומרים לחבר. דרב מבין. ולבעלי עסקים: אפליקציה שאין לאף אחד אחר.",
      explore: "לגלות את העיר",
      showroom: "לראות את התצוגה",
      scroll: "גללו",
    },
    story: {
      eyebrow: "למה דרב",
      paragraphs: [
        "דרב נולד מאהבה לבנות דברים שאנשים נהנים להשתמש בהם, מהרגע שבו מסך מרגיש חי ביד.",
        "ומתסכול פשוט: למצוא מקום לא אמור לדרוש עשר אפליקציות ואת מילות החיפוש המדויקות. אז בנינו מקום אחד שמבין אותך כמו שאתה באמת מדבר, בכל שפה, גם חצי-חצי.",
        "רצינו יותר ממדריך. כל עסק ראוי לחוויה שנבנתה בשבילו, לא לתבנית שהוא חולק עם חמישים אחרים. כשקרמל עלו לאוויר, האפליקציה שלהם לא נראתה כמו של אף אחד אחר. זה הסטנדרט שלנו.",
        "כל סוג של עסק. כל עיר וכל כפר. דרך אחת: דרב.",
      ],
      signature: "דרב",
      role: "דרך אחת לכל עסק",
    },
    platform: {
      eyebrow: "איך זה עובד",
      title: "פלטפורמה אחת. כל השכבות.",
      layers: [
        { title: "העסק שלכם", body: "המקום האמיתי: השעות, האנשים, הסיפור." },
        {
          title: "אפליקציה רק בשבילכם",
          body: "תפריט, הזמנות וחוויה שעוצבו מאפס. אף פעם לא תבנית.",
        },
        {
          title: "חיפוש חכם שמבין",
          body: "כותבים כמו שמדברים, בכל שפה, גם מעורבב.",
        },
        { title: "כל סוג, כל אזור", body: "מאתיים סוגי עסקים בערים ובכפרים, על מפה חיה אחת." },
        { title: "אנשים שמוצאים אתכם", body: "לקוחות מגיעים אליכם, לא לפרסומת של המתחרה." },
      ],
      without: {
        label: "בלי דרב",
        body: "עשר אפליקציות. תבניות גנריות. חיפוש שדורש את המילה המדויקת.",
      },
      with: { label: "עם דרב", body: "דרך אחת. אפליקציה שהיא שלכם. חיפוש שמבין אתכם." },
    },
    search: {
      eyebrow: "חיפוש חכם",
      title: "בלי להסביר יותר מדי.",
      body: "דרב מבין כוונה, שפה ומקום. נסו:",
      examples: ["מסעדה ללא גלוטן בעכו", "מספרה בנצרת", "תחנת דלק בקריית אתא"],
    },
    made: {
      eyebrow: "נבנה על ידי דרב",
      title: "לא תבנית. חוויה.",
      body: "כל לקוח מקבל משהו שנבנה רק בשבילו. אלה חיים, עכשיו:",
      open: "לפתוח בתצוגה",
      clients: [
        { name: "קרמל", kind: "מסעדה ללא גלוטן · עכו", url: CLIENT_URLS.caramel },
        { name: "רגד ביוטי", kind: "קוסמטיקה · נחף", url: CLIENT_URLS.raghad },
        { name: "פז", kind: "תחנות דלק · קריית אתא וקריית מוצקין", url: CLIENT_URLS.paz },
      ],
    },
    join: {
      title: "רוצים אפליקציה שאין לאף אחד אחר?",
      body: "ספרו לנו על העסק. נבנה לו דרך משלו.",
      pricing: "לראות את התוכניות",
      talk: "לדבר איתנו",
    },
  },
  ar: {
    title: "درب | درب واحد لكل مصلحة",
    description: "لاقي أي مصلحة متل ما بتحكي. ولأصحاب المصالح: تطبيق معمول إلكم وبس.",
    hero: {
      eyebrow: "درب · דרב · Darb",
      title: "درب واحد",
      accent: "لكل مصلحة.",
      lead: "اكتبها متل ما بتحكيها لصاحبك. درب بفهم عليك. وإذا عندك مصلحة: تطبيق ما حدا عنده متله.",
      explore: "اكتشف البلد",
      showroom: "شوف المعرض",
      scroll: "انزل",
    },
    story: {
      eyebrow: "ليش درب",
      paragraphs: [
        "درب طلع من حب إنّا نعمل أشيا الناس بتنبسط وهي تستعملها، من اللحظة اللي بتحس فيها إنّه الشاشة صارت عايشة بإيدك.",
        "وطلع من قهر بسيط: لتلاقي محل، مش لازم تفتح عشر تطبيقات وتدوّر عالكلمة الصح. فعملنا مكان واحد بفهم عليك متل ما بتحكي، بأي لغة، وحتى نص بنص.",
        "وبدنا أكتر من دليل. كل مصلحة بتستاهل تجربة معمولة إلها، مش قالب بتتقاسمه مع خمسين غيرها. لما كراميل نزلت لايف، تطبيقها ما كان يشبه حدا. هاد المستوى تبعنا.",
        "كل أنواع المصالح. كل بلد وكل قرية. درب واحد: درب.",
      ],
      signature: "درب",
      role: "درب واحد لكل مصلحة",
    },
    platform: {
      eyebrow: "كيف بزبط",
      title: "منصة وحدة. كل الطبقات.",
      layers: [
        { title: "مصلحتك", body: "المحل الحقيقي: الدوام، الناس، القصة." },
        { title: "تطبيق إلك وبس", body: "منيو وحجوزات وتجربة معمولين من الصفر. ولا مرة قالب." },
        { title: "بحث ذكي بفهم عليك", body: "اكتب متل ما بتحكي، بأي لغة، وحتى مخلوطة." },
        {
          title: "كل نوع، كل منطقة",
          body: "أكتر من ميتين نوع مصلحة بالبلاد والقرى، على خريطة لايف وحدة.",
        },
        { title: "ناس بلاقوك", body: "الزباين بوصلوا لعندك، مش لإعلان المنافس." },
      ],
      without: {
        label: "بلا درب",
        body: "عشر تطبيقات. قوالب كلها شبه بعض. بحث بدّه الكلمة بالزبط.",
      },
      with: { label: "مع درب", body: "درب واحد. تطبيق إلك. بحث بفهم عليك." },
    },
    search: {
      eyebrow: "بحث ذكي",
      title: "بلا شرح كتير.",
      body: "درب بفهم شو بدك، بأي لغة ووين. جرّب:",
      examples: ["مطعم بلا غلوتين بعكا", "حلاق بالناصرة", "محطة بنزين بكريات آتا"],
    },
    made: {
      eyebrow: "معمول بدرب",
      title: "مش قالب. تجربة.",
      body: "كل زبون بياخد إشي معمول إله وبس. هدول لايف هلأ:",
      open: "افتح بالمعرض",
      clients: [
        { name: "كراميل", kind: "مطعم بلا غلوتين · عكا", url: CLIENT_URLS.caramel },
        { name: "رغد بيوتي", kind: "منتجات تجميل · نحف", url: CLIENT_URLS.raghad },
        { name: "باز", kind: "محطات بنزين · كريات آتا وكريات موتسكين", url: CLIENT_URLS.paz },
      ],
    },
    join: {
      title: "بدك تطبيق ما حدا عنده متله؟",
      body: "احكيلنا عن مصلحتك. منعملها درب خاص فيها.",
      pricing: "شوف الخطط",
      talk: "احكي معنا",
    },
  },
  en: {
    title: "Darb | One path to every business",
    description: "Find any business the way you talk. And for owners: an app built for you alone.",
    hero: {
      eyebrow: "Darb · درب · דרב",
      title: "One path",
      accent: "to every business.",
      lead: "Type it the way you'd say it to a friend. Darb gets it. And if you own the business: an app nobody else has.",
      explore: "Explore the city",
      showroom: "See the showroom",
      scroll: "Scroll",
    },
    story: {
      eyebrow: "Why Darb",
      paragraphs: [
        "Darb was born from a love of building things people enjoy using, the moment a screen feels alive in your hand.",
        "And from a simple frustration: finding a place shouldn't take ten apps and the exact right keywords. So we built one place that understands you the way you actually talk, in any language, even half and half.",
        "We wanted more than a directory. Every business deserves an experience made for it, not a template it shares with fifty others. When Caramel went live, its app looked like no one else's. That's our standard.",
        "Every kind of business. Every town and village. One path: Darb.",
      ],
      signature: "Darb",
      role: "One path to every business",
    },
    platform: {
      eyebrow: "How it works",
      title: "One platform. Every layer.",
      layers: [
        { title: "Your business", body: "The real thing: your hours, your people, your story." },
        {
          title: "An app made only for you",
          body: "Menu, bookings and an experience designed from zero. Never a template.",
        },
        {
          title: "Search that gets you",
          body: "Type it like you'd say it, in any language, even mixed.",
        },
        {
          title: "Every kind, every district",
          body: "Two hundred kinds of businesses across towns and villages, on one live map.",
        },
        {
          title: "People who find you",
          body: "Customers arrive at your door, not at a competitor's ad.",
        },
      ],
      without: {
        label: "Without Darb",
        body: "Ten apps. Look-alike templates. Search that needs the exact word.",
      },
      with: { label: "With Darb", body: "One path. An app that's yours. Search that understands." },
    },
    search: {
      eyebrow: "Smart search",
      title: "No need to over-explain.",
      body: "Darb understands intent, language and place. Try:",
      examples: ["gluten-free in Akko", "barber in Nazareth", "fuel station in Kiryat Ata"],
    },
    made: {
      eyebrow: "Built by Darb",
      title: "Not a template. An experience.",
      body: "Every client gets something made for them alone. These are live, right now:",
      open: "Open in the showroom",
      clients: [
        { name: "Caramel", kind: "Gluten-free restaurant · Akko", url: CLIENT_URLS.caramel },
        { name: "Raghad Beauty", kind: "Cosmetics · Nahf", url: CLIENT_URLS.raghad },
        {
          name: "Paz",
          kind: "Fuel stations · Kiryat Ata and Kiryat Motzkin",
          url: CLIENT_URLS.paz,
        },
      ],
    },
    join: {
      title: "Want an app nobody else has?",
      body: "Tell us about your business. We'll build it a path of its own.",
      pricing: "See the plans",
      talk: "Talk to us",
    },
  },
};
