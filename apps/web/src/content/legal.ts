import type { Locale } from "@darb/core";

/** The date every legal page was last updated (ISO, for `<time dateTime>`). */
export const LEGAL_UPDATED = "2026-10-15";

export const LEGAL_CONTACT = { email: "founder@darb.co.il" };

export const LEGAL_KINDS = ["accessibility", "terms", "privacy"] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

/** A paragraph, or a bulleted list. Latin runs (names, addresses) are isolated when rendered. */
export type LegalBlock = string | { list: readonly string[] };

export interface LegalSection {
  /** The anchor: the same in every locale, so a link to a section works in all three. */
  id: string;
  title: string;
  blocks: readonly LegalBlock[];
}

export interface LegalDoc {
  title: string;
  lead: string;
  sections: readonly LegalSection[];
}

export interface LegalChrome {
  contents: string;
  updated: string;
  notice: string;
}

export const legalChrome: Record<Locale, LegalChrome> = {
  he: {
    contents: "בעמוד זה",
    updated: "עודכן לאחרונה",
    notice:
      "המסמך מוגש לשם מידע. הוא זמין גם בערבית ובאנגלית, ואם יש הבדל בין הנוסחים, הנוסח העברי הוא הקובע.",
  },
  ar: {
    contents: "بهاي الصفحة",
    updated: "آخر تحديث",
    notice:
      "هاي الوثيقة للمعلومات. موجودة كمان بالعبري والإنجليزي، وإذا في أي فرق بين النسخ، النص العبري هو المعتمد.",
  },
  en: {
    contents: "On this page",
    updated: "Last updated",
    notice:
      "This document is provided for information. It is also available in Hebrew and Arabic, and if the versions differ, the Hebrew version prevails.",
  },
};

const accessibility: Record<Locale, LegalDoc> = {
  he: {
    title: "הצהרת נגישות",
    lead: "אנחנו רוצים שכל אחד ואחת יוכלו למצוא עסק בדרב, כולל אנשים עם מוגבלות. כאן מוסבר מה עשינו, מה עדיין מוגבל ואיך לפנות אלינו.",
    sections: [
      {
        id: "commitment",
        title: "המחויבות שלנו",
        blocks: [
          "דרב פועל להנגשת האתר לפי חוק שוויון זכויות לאנשים עם מוגבלות, התשנ״ח-1998, תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע״ג-2013, ובפרט תקנה 35, ותקן ישראלי ת״י 5568, המבוסס על הנחיות WCAG 2.0 הבינלאומיות.",
          "רמת הנגישות שאנחנו מכוונים אליה היא AA. אנחנו בודקים את האתר גם מול כללי A ו-AA של הגרסאות החדשות יותר, WCAG 2.1 ו-WCAG 2.2.",
        ],
      },
      {
        id: "adjustments",
        title: "מה עשינו",
        blocks: [
          {
            list: [
              "קישור ״דילוג לתוכן״ בראש כל עמוד, שמופיע כשהוא מקבל פוקוס מהמקלדת.",
              "אפשר להגיע לכל קישור, כפתור ושדה ולהפעיל אותם במקלדת, ומסגרת פוקוס ברורה מראה איפה אתם נמצאים.",
              "העמודים בנויים עם כותרות לפי הסדר ועם אזורים מסומנים (כותרת האתר, ניווט ותוכן ראשי), כדי שקוראי מסך יוכלו לנווט בהם.",
              "כל שפה מוגדרת בעמוד עם השפה והכיוון שלה: עברית וערבית מימין לשמאל, אנגלית משמאל לימין.",
              "אם המערכת שלכם מבקשת להפחית תנועה, האנימציות והמעברים באתר כמעט מתבטלים.",
              "לתמונות ולסמלים שמעבירים מידע יש חלופה טקסטואלית, סמלים קישוטיים מוסתרים מקוראי מסך, ולכפתורים ולפקדים יש שמות נגישים.",
              "צבעי הטקסט עומדים בניגודיות ברמת AA. בתצוגות האפליקציות של עסקים, אם צבע של עסק חלש מדי, הטקסט עובר אוטומטית לצבע קריא.",
              "האתר לא חוסם הגדלה בדפדפן, והפריסה מתאימה את עצמה למסכים צרים ולטלפונים.",
              "למפה ולרשת הקטגוריות והעסקים יש שמות נגישים. תצוגת הרשימה מציגה את אותם עסקים כקישורים רגילים, והיא חלופה מלאה למפה החזותית. בטלפון, כפתור אחד עובר בין מפה לרשימה.",
              "כל שינוי באתר עובר בדיקת נגישות אוטומטית (axe) בעמודים המרכזיים בשלוש השפות לפני שהוא נכנס לאתר.",
            ],
          },
        ],
      },
      {
        id: "testing",
        title: "איך בדקנו",
        blocks: [
          "האתר נבדק בכלים אוטומטיים (axe בדפדפן Chromium) מול כללי A ו-AA של WCAG 2.0, 2.1 ו-2.2, בעברית, בערבית ובאנגלית, ובבדיקות ניווט במקלדת.",
          "עדיין לא ערכנו בדיקה מלאה עם קוראי מסך. כשנעשה זאת, נעדכן את ההצהרה הזו.",
        ],
      },
      {
        id: "limitations",
        title: "מגבלות ידועות",
        blocks: [
          {
            list: [
              "המפה האינטראקטיבית מופעלת בעכבר או במגע בלבד. משתמשי מקלדת וקוראי מסך יכולים להשתמש בתצוגת הרשימה, שבה אותם עסקים.",
              "נתוני המפה, כולל שמות רחובות ומקומות, מגיעים מתורמי OpenStreetMap דרך Protomaps. אין לנו שליטה מלאה על התוכן הזה.",
              "קישורים לאפליקציות החיות של עסקים שהם לקוחות שלנו פותחים אתרים שמופעלים על ידי העסקים עצמם. הנגישות שלהם באחריות כל עסק.",
            ],
          },
          "אם נתקלתם במגבלה שלא מופיעה כאן, נשמח לשמוע.",
        ],
      },
      {
        id: "report",
        title: "נתקלתם בבעיה?",
        blocks: [
          "כתבו לרכז הנגישות בכתובת founder@darb.co.il. כדי שנוכל לעזור מהר, ציינו:",
          {
            list: [
              "כתובת העמוד שבו הייתה הבעיה.",
              "מה ניסיתם לעשות ומה קרה.",
              "המכשיר, הדפדפן והטכנולוגיה המסייעת שבהם השתמשתם (למשל קורא מסך), ואם אפשר, הגרסאות שלהם.",
              "צילום מסך, אם הוא עוזר להסביר.",
            ],
          },
        ],
      },
      {
        id: "coordinator",
        title: "רכז הנגישות",
        blocks: ["נור אלדין מוסא, מייסד דרב. אימייל: founder@darb.co.il"],
      },
      {
        id: "response",
        title: "איך אנחנו עונים",
        blocks: [
          "אנחנו קוראים כל פנייה, עונים בתוך זמן סביר ומשתדלים לתקן בעיות מהר ככל האפשר. אם תיקון ייקח זמן, נעדכן אתכם, ואם אפשר, נציע דרך אחרת לקבל את המידע שחיפשתם.",
        ],
      },
      {
        id: "updated",
        title: "עדכון ההצהרה",
        blocks: ["ההצהרה עודכנה לאחרונה ב-15 באוקטובר 2026."],
      },
    ],
  },
  ar: {
    title: "بيان الإتاحة",
    lead: "بدنا كل الناس يقدروا يلاقوا مصلحة على درب، ومن ضمنهم الأشخاص مع إعاقة. هون منشرح شو عملنا، شو لسا محدود، وكيف توصلولنا.",
    sections: [
      {
        id: "commitment",
        title: "التزامنا",
        blocks: [
          "يعمل درب على إتاحة الموقع وفق قانون المساواة في الحقوق للأشخاص ذوي الإعاقة، 5758-1998، وأنظمة المساواة في الحقوق للأشخاص ذوي الإعاقة (ملاءمات الإتاحة للخدمة)، 5773-2013، وخاصة النظام 35، والمعيار الإسرائيلي 5568 المبني على إرشادات WCAG 2.0 الدولية.",
          "مستوى الإتاحة الذي نسعى إليه هو AA. ونفحص الموقع أيضًا وفق قواعد A وAA في الإصدارات الأحدث WCAG 2.1 وWCAG 2.2.",
        ],
      },
      {
        id: "adjustments",
        title: "شو عملنا",
        blocks: [
          {
            list: [
              "رابط «الانتقال إلى المحتوى» في أعلى كل صفحة، يظهر عندما يصل إليه تركيز لوحة المفاتيح.",
              "يمكن الوصول إلى كل رابط وزر وحقل واستخدامه بلوحة المفاتيح، وإطار تركيز واضح يبيّن مكانكم.",
              "الصفحات مبنية بعناوين مرتبة ومناطق معلَّمة (رأس الموقع، التنقل، المحتوى الرئيسي) ليتمكّن قارئ الشاشة من التنقل فيها.",
              "كل لغة معرَّفة في الصفحة بلغتها واتجاهها: العربية والعبرية من اليمين إلى اليسار، والإنجليزية من اليسار إلى اليمين.",
              "إذا طلب نظامكم تقليل الحركة، تتوقف الرسوم المتحركة والانتقالات في الموقع تقريبًا.",
              "للصور والرموز التي تحمل معلومات بديل نصي، والرموز الزخرفية مخفية عن قارئ الشاشة، وللأزرار وعناصر التحكم أسماء قابلة للقراءة.",
              "ألوان النصوص تحقق التباين بمستوى AA. وفي عروض تطبيقات المصالح، إذا كان لون المصلحة باهتًا جدًا، يتحول النص تلقائيًا إلى لون مقروء.",
              "الموقع لا يمنع التكبير في المتصفح، والتصميم يتكيف مع الشاشات الضيقة والهواتف.",
              "للخريطة ولشبكة الفئات والمصالح أسماء قابلة للقراءة. وعرض القائمة يُظهر المصالح نفسها كروابط عادية، وهو بديل كامل للخريطة المرئية. وعلى الهاتف، زر واحد ينقل بين الخريطة والقائمة.",
              "كل تغيير في الموقع يمر بفحص إتاحة آلي (axe) للصفحات الرئيسية باللغات الثلاث قبل أن يُنشر.",
            ],
          },
        ],
      },
      {
        id: "testing",
        title: "كيف فحصنا الموقع",
        blocks: [
          "فُحص الموقع بأدوات آلية (axe في متصفح Chromium) وفق قواعد A وAA في WCAG 2.0 و2.1 و2.2، بالعربية والعبرية والإنجليزية، وبفحوصات تنقل بلوحة المفاتيح.",
          "لم نُجرِ بعد فحصًا كاملًا باستخدام قارئات الشاشة. عندما نفعل ذلك، سنحدّث هذا البيان.",
        ],
      },
      {
        id: "limitations",
        title: "أشياء لسا محدودة",
        blocks: [
          {
            list: [
              "الخريطة التفاعلية تعمل بالفأرة أو باللمس فقط. يمكن لمستخدمي لوحة المفاتيح وقارئ الشاشة استخدام عرض القائمة، وفيه المصالح نفسها.",
              "بيانات الخريطة، ومنها أسماء الشوارع والأماكن، مصدرها المساهمون في OpenStreetMap عبر Protomaps، وليست لنا سيطرة كاملة على هذا المحتوى.",
              "روابط التطبيقات اللايف لمصالح هي من زبائننا تفتح مواقع تديرها تلك المصالح نفسها، وإتاحتها مسؤولية كل مصلحة.",
            ],
          },
          "إذا لقيتوا إشي محدود مش مذكور هون، كتير منحب نسمع منكم.",
        ],
      },
      {
        id: "report",
        title: "لقيتوا مشكلة؟",
        blocks: [
          "اكتبوا لمنسق الإتاحة على founder@darb.co.il. عشان نقدر نساعد بسرعة، اكتبوا:",
          {
            list: [
              "عنوان الصفحة التي حدثت فيها المشكلة.",
              "ما الذي حاولتم فعله وما الذي حدث.",
              "الجهاز والمتصفح والتقنية المساعدة التي استخدمتموها (مثل قارئ الشاشة)، وإصداراتها إن أمكن.",
              "صورة للشاشة، إذا كانت تساعد في الشرح.",
            ],
          },
        ],
      },
      {
        id: "coordinator",
        title: "منسق الإتاحة",
        blocks: ["نور الدين موسى، مؤسس درب. البريد الإلكتروني: founder@darb.co.il"],
      },
      {
        id: "response",
        title: "كيف منرد عليكم",
        blocks: [
          "نقرأ كل توجّه، ونرد خلال وقت معقول، ونحاول إصلاح المشاكل بأسرع ما يمكن. إذا احتاج الإصلاح إلى وقت، سنُعلمكم، وإن أمكن سنقترح طريقة أخرى للحصول على المعلومات التي تبحثون عنها.",
        ],
      },
      {
        id: "updated",
        title: "تحديث البيان",
        blocks: ["حُدّث هذا البيان آخر مرة في 15 أكتوبر 2026."],
      },
    ],
  },
  en: {
    title: "Accessibility statement",
    lead: "We want everyone to be able to find a business on Darb, including people with disabilities. This statement explains what we have done, what is still limited, and how to reach us.",
    sections: [
      {
        id: "commitment",
        title: "Our commitment",
        blocks: [
          "Darb works to make this site accessible in line with the Equal Rights for Persons with Disabilities Law, 5758-1998, the Equal Rights for Persons with Disabilities (Service Accessibility Adjustments) Regulations, 5773-2013, in particular regulation 35, and Israeli Standard IS 5568, which is based on the international WCAG 2.0 guidelines.",
          "The level we aim for is AA. We also check the site against the A and AA rules of the newer WCAG 2.1 and WCAG 2.2.",
        ],
      },
      {
        id: "adjustments",
        title: "What we have done",
        blocks: [
          {
            list: [
              'A "Skip to content" link at the top of every page, which appears when it gets keyboard focus.',
              "Every link, button and field can be reached and used with the keyboard, and a clear focus ring shows where you are.",
              "Pages use headings in order and marked regions (site header, navigation and main content), so screen readers can move around them.",
              "Each language sets its own language and direction on the page: Hebrew and Arabic right to left, English left to right.",
              "If your system asks for reduced motion, the site's animations and transitions are all but switched off.",
              "Images and icons that carry information have a text alternative, decorative ones are hidden from screen readers, and buttons and controls have accessible names.",
              "Text colours meet AA contrast. In the previews of business apps, if a business's colour would be too faint, the text switches to a readable colour on its own.",
              "The site does not block browser zoom, and the layout adapts to narrow screens and phones.",
              "The map and the grid of categories and businesses have accessible names. The list view shows the same businesses as ordinary links and is a full alternative to the visual map. On a phone, one button switches between map and list.",
              "Every change to the site runs an automated accessibility check (axe) on the main pages in all three languages before it goes live.",
            ],
          },
        ],
      },
      {
        id: "testing",
        title: "How we checked",
        blocks: [
          "The site was checked with automated tools (axe in the Chromium browser) against the WCAG 2.0, 2.1 and 2.2 A and AA rules, in Hebrew, Arabic and English, and with keyboard navigation checks.",
          "We have not yet carried out a full check with screen readers. When we do, we will update this statement.",
        ],
      },
      {
        id: "limitations",
        title: "Known limitations",
        blocks: [
          {
            list: [
              "The interactive map works with a mouse or touch only. Keyboard and screen reader users can use the list view, which has the same businesses.",
              "Map data, including street and place names, comes from OpenStreetMap contributors through Protomaps, and we do not fully control it.",
              "Links to the live apps of our client businesses open sites run by those businesses. Their accessibility is each business's responsibility.",
            ],
          },
          "If you find a limitation that is not listed here, we would like to hear about it.",
        ],
      },
      {
        id: "report",
        title: "Found a problem?",
        blocks: [
          "Write to the accessibility coordinator at founder@darb.co.il. To help us fix it quickly, please include:",
          {
            list: [
              "The address of the page where the problem happened.",
              "What you tried to do and what happened.",
              "The device, browser and assistive technology you use (for example a screen reader), with their versions if you know them.",
              "A screenshot, if it helps explain.",
            ],
          },
        ],
      },
      {
        id: "coordinator",
        title: "Accessibility coordinator",
        blocks: ["Noor Alden Mousa, founder of Darb. Email: founder@darb.co.il"],
      },
      {
        id: "response",
        title: "How we respond",
        blocks: [
          "We read every request, answer within a reasonable time and try to fix problems as quickly as we can. If a fix will take time, we will tell you and, where possible, offer another way to get the information you were looking for.",
        ],
      },
      {
        id: "updated",
        title: "About this statement",
        blocks: ["This statement was last updated on 15 October 2026."],
      },
    ],
  },
};

const privacy: Record<Locale, LegalDoc> = {
  he: {
    title: "מדיניות פרטיות",
    lead: "דרב הוא מדריך עסקים שמשתמשים בו בלי חשבון. המדיניות הזו מסבירה איזה מידע האתר מעבד כשאתם משתמשים בו, למה, לכמה זמן ומה הזכויות שלכם.",
    sections: [
      {
        id: "who",
        title: "מי אנחנו",
        blocks: [
          "דרב (darb.co.il) מופעל על ידי נור אלדין מוסא, מייסד דרב, בישראל. הוא האחראי על המידע המתואר כאן (בעל מאגר המידע לפי חוק הגנת הפרטיות). לפניות: founder@darb.co.il.",
          "המדיניות נכתבה לפי חוק הגנת הפרטיות, התשמ״א-1981, כולל תיקון 13 שנכנס לתוקף באוגוסט 2025, ולפי תקנות הגנת הפרטיות (אבטחת מידע), התשע״ז-2017.",
        ],
      },
      {
        id: "no-accounts",
        title: "בלי חשבונות למבקרים",
        blocks: [
          "אין צורך להירשם או להתחבר כדי להשתמש בדרב. אנחנו לא מבקשים שם, טלפון או אימייל כדי לחפש או לגלוש. אין חובה חוקית למסור לנו מידע, ואתם מוסרים רק את מה שתבחרו לשלוח, למשל כשאתם כותבים לנו.",
        ],
      },
      {
        id: "data",
        title: "איזה מידע האתר מעבד",
        blocks: [
          {
            list: [
              "חיפושים: כשאתם מחפשים, נשמרת רשומה עם טקסט החיפוש (עד 200 תווים), השפה, איך החיפוש הובן, כמה תוצאות חזרו, ואם פתחתם תוצאה בתוך 24 שעות, איזו. הרשומה לא כוללת כתובת IP, פרטי מכשיר, מיקום או חשבון. אנחנו משתמשים בה כדי לשפר את החיפוש ולראות אילו מקומות ועסקים מחפשים ולא מוצאים.",
              "מיקום עבור ״קרוב אליי״: רק אם לחצתם על ״קרוב אליי״ או על מיון לפי מרחק, ואישרתם זאת בדפדפן. המיקום מעוגל לכ-110 מטר ונשלח בגוף הבקשה כדי למצוא מקומות ועסקים קרובים. הוא משמש לבקשה הזו בלבד ולא נשמר ולא נרשם ביומן.",
              "כתובת IP להגבלת קצב: כדי להגן על השירות מפני שימוש לרעה, כתובת ה-IP משמשת לספירת בקשות לדקה. השרת של ה-API סופר גיבוב (hash) של הכתובת עם מפתח סודי, ולא את הכתובת עצמה, והספירה נמחקת אחרי כדקה. שרת האתר עשוי להחזיק את הכתובת בזיכרון לזמן קצר לאותה מטרה. היא אף פעם לא נשמרת ברשומת החיפוש.",
              "יומנים טכניים: כמו בכל אתר, ספקי האחסון שלנו מעבדים פרטים טכניים של כל בקשה (כמו כתובת IP, דפדפן ושעה) כדי להגיש את העמודים ולשמור על אבטחתם, לפי התנאים שלהם.",
              "אימייל שאתם שולחים לנו: אם כתבתם לנו, נשמור את ההודעה ואת הכתובת שלכם כדי לענות לכם, וכל עוד זה נדרש לשם כך.",
            ],
          },
          "אל תקלידו בתיבת החיפוש פרטים אישיים, כמו שמות, מספרי זהות או טלפונים.",
        ],
      },
      {
        id: "cookies",
        title: "עוגיות ואחסון בדפדפן",
        blocks: [
          "העמודים הציבוריים לא שומרים עוגיות (cookies), לא משתמשים באחסון המקומי של הדפדפן ולא מפעילים כלי אנליטיקה, פרסום או מעקב. הגופנים מוגשים מהאתר שלנו, ואריחי המפה נטענים משרת המפות שלנו (tiles.darb.co.il, על Cloudflare).",
          "עוגיות משמשות רק באזור הניהול של צוות דרב (/admin), להתחברות דרך Clerk.",
        ],
      },
      {
        id: "purposes",
        title: "למה אנחנו משתמשים במידע",
        blocks: [
          {
            list: [
              "להפעיל את החיפוש ולהציג תוצאות.",
              "למצוא מקומות קרובים אליכם, כשאתם מבקשים.",
              "להגן מפני שימוש לרעה ולשמור על אבטחת השירות.",
              "לשפר את איכות החיפוש ואת המדריך.",
              "לענות לפניות שלכם.",
            ],
          },
          "אנחנו לא מוכרים מידע, לא משתמשים בו לפרסום ולא בונים פרופילים של מבקרים.",
        ],
      },
      {
        id: "consent",
        title: "בסיס חוקי והסכמה",
        blocks: [
          "השימוש בחיפוש ובמפה הוא מרצון. המיקום משמש רק באישור שלכם בדפדפן, ואפשר לבטל את האישור בכל עת בהגדרות הדפדפן. שאר העיבוד נדרש כדי לתת את השירות שביקשתם ולשמור על אבטחתו, כמתואר במדיניות הזו.",
        ],
      },
      {
        id: "providers",
        title: "ספקי שירות והעברה לחו״ל",
        blocks: [
          "אנחנו נעזרים בספקים האלה כדי להפעיל את השירות, וחלקם פועלים מחוץ לישראל. כל ספק מקבל רק את מה שהוא צריך:",
          {
            list: [
              "Vercel: אחסון האתר.",
              "Railway: הפעלת ה-API ומטמון Redis שלו, באיחוד האירופי.",
              "Neon: מסד הנתונים, בפרנקפורט, גרמניה.",
              "Cloudflare: אריחי המפה (אחסון R2), ומרגע העברת הדומיין גם DNS.",
              "Anthropic (Claude): מקבל את טקסט החיפוש, את השפה ורשימה של קטגוריות ומקומות מתאימים, כדי להבין מה אתם מחפשים. התשובה נשמרת במטמון עד 7 ימים לפי טקסט החיפוש, בלי שום פרט עליכם.",
              "Voyage AI: מקבל את טקסט החיפוש כדי לחשב ייצוג מספרי (embedding) שעוזר לדרג תוצאות.",
              "Clerk: התחברות של צוות דרב לאזור הניהול בלבד.",
              "נתוני המפה: © תורמי OpenStreetMap, דרך Protomaps.",
            ],
          },
          "המידע מועבר לחו״ל, כולל לאיחוד האירופי ולארצות הברית, לפי תקנות הגנת הפרטיות (העברת מידע אל מאגרי מידע שמחוץ לגבולות המדינה), התשס״א-2001. אנחנו בוחרים ספקים שמתחייבים להגן על המידע.",
        ],
      },
      {
        id: "retention",
        title: "כמה זמן אנחנו שומרים",
        blocks: [
          {
            list: [
              "רשומות חיפוש נמחקות אוטומטית אחרי 90 יום.",
              "ספירות הגבלת הקצב נמחקות אחרי כדקה.",
              "המיקום שלכם לא נשמר בכלל.",
              "הבנת החיפוש במטמון, שאין בה פרט עליכם, נשמרת עד 7 ימים.",
              "פניות באימייל נשמרות כל עוד הן נדרשות כדי לטפל בהן.",
            ],
          },
        ],
      },
      {
        id: "security",
        title: "אבטחת מידע",
        blocks: [
          "המידע מוצפן בדרך (HTTPS). הגישה למסד הנתונים ולאזור הניהול מוגבלת לצוות מורשה עם התחברות. מפתחות וסודות לא נשמרים בקוד. כתובות IP עוברות גיבוב עם מפתח סודי לפני הספירה. העמודים נשלחים עם כותרות אבטחה, כולל מדיניות אבטחת תוכן (CSP).",
          "אנחנו פועלים לפי תקנות אבטחת המידע ברמה שמתאימה למאגר. אין מערכת שמוגנת לגמרי, ואם יקרה אירוע אבטחה חמור, נפעל כפי שהחוק מחייב.",
        ],
      },
      {
        id: "rights",
        title: "הזכויות שלכם",
        blocks: [
          "לפי סעיף 13 לחוק הגנת הפרטיות, אתם רשאים לעיין במידע עליכם שנמצא במאגר שלנו. לפי סעיף 14, אתם רשאים לבקש לתקן או למחוק מידע שאינו נכון, שלם, ברור או מעודכן.",
          "שלחו בקשה ל-founder@darb.co.il, ונענה בתוך הזמנים שקובע החוק. רשומות החיפוש לא כוללות פרטים מזהים, ולכן בדרך כלל לא נוכל לקשר רשומה לאדם מסוים. אם כך, נאמר לכם.",
          "אפשר גם לפנות לרשות להגנת הפרטיות.",
        ],
      },
      {
        id: "businesses",
        title: "דפי העסקים",
        blocks: [
          "דפי העסקים מציגים מידע עסקי ציבורי, כמו שם, כתובת, טלפון, שעות פתיחה, קישורים וקטגוריה. אם אתם בעלים או נציגים של עסק שמופיע בדרב ורוצים לתקן או להסיר פרטים, כתבו לנו.",
        ],
      },
      {
        id: "children",
        title: "ילדים",
        blocks: [
          "דרב הוא מדריך כללי בלי חשבונות, ואנחנו לא אוספים ביודעין מידע על ילדים. אם הורה חושב שילד שלח לנו מידע אישי, פנו אלינו ונמחק אותו.",
        ],
      },
      {
        id: "changes",
        title: "שינויים במדיניות",
        blocks: [
          "אנחנו עשויים לעדכן את המדיניות. התאריך בראש העמוד מראה מתי היא עודכנה, ושינוי מהותי נציין בעמוד הזה.",
        ],
      },
      {
        id: "contact",
        title: "יצירת קשר",
        blocks: ["לכל שאלה על פרטיות: נור אלדין מוסא, founder@darb.co.il."],
      },
    ],
  },
  ar: {
    title: "سياسة الخصوصية",
    lead: "درب دليل مصالح بتستعملوه بدون حساب. هاي السياسة بتشرح أي معلومات الموقع بيعالج لما تستعملوه، ليش، لقديش وقت، وشو حقوقكم.",
    sections: [
      {
        id: "who",
        title: "مين إحنا",
        blocks: [
          "يدير درب (darb.co.il) نور الدين موسى، مؤسس درب، في إسرائيل. وهو المسؤول عن المعلومات الموصوفة هنا (صاحب قاعدة البيانات بحسب قانون حماية الخصوصية). للتواصل: founder@darb.co.il.",
          "كُتبت هذه السياسة وفق قانون حماية الخصوصية، 5741-1981، بما في ذلك التعديل 13 الذي دخل حيز التنفيذ في أغسطس 2025، ووفق أنظمة حماية الخصوصية (أمن المعلومات)، 5777-2017.",
        ],
      },
      {
        id: "no-accounts",
        title: "بدون حسابات للزوار",
        blocks: [
          "لا حاجة للتسجيل أو تسجيل الدخول لاستخدام درب. لا نطلب اسمًا أو هاتفًا أو بريدًا إلكترونيًا للبحث أو التصفح. لا يوجد إلزام قانوني بتزويدنا بأي معلومات، وأنتم تشاركون فقط ما تختارون إرساله، مثلًا عندما تكتبون لنا.",
        ],
      },
      {
        id: "data",
        title: "أي معلومات الموقع بيعالج",
        blocks: [
          {
            list: [
              "عمليات البحث: عندما تبحثون، يُحفظ سجل فيه نص البحث (حتى 200 حرف)، واللغة، وكيف فُهم البحث، وعدد النتائج، وإذا فتحتم نتيجة خلال 24 ساعة، أيّها. لا يتضمن السجل عنوان IP أو تفاصيل الجهاز أو الموقع الجغرافي أو أي حساب. نستخدمه لتحسين البحث ولمعرفة الأماكن والمصالح التي يبحث عنها الناس ولا يجدونها.",
              "الموقع الجغرافي لـ«بالقرب مني»: فقط إذا ضغطتم «بالقرب مني» أو الترتيب حسب المسافة، ووافقتم على ذلك في المتصفح. يُقرَّب الموقع إلى نحو 110 أمتار ويُرسل داخل الطلب لإيجاد الأماكن والمصالح القريبة. يُستخدم لهذا الطلب فقط، ولا يُحفظ ولا يُسجَّل.",
              "عنوان IP لتحديد معدل الطلبات: لحماية الخدمة من إساءة الاستخدام، يُستخدم عنوان IP لعدّ الطلبات في الدقيقة. يعدّ خادم الـ API بصمة مشفّرة (hash) للعنوان بمفتاح سري، لا العنوان نفسه، ويُحذف العدّ بعد نحو دقيقة. وقد يحتفظ خادم الموقع بالعنوان في الذاكرة لوقت قصير للغرض نفسه. ولا يُحفظ أبدًا في سجل البحث.",
              "السجلات التقنية: كما في أي موقع، يعالج مزوّدو الاستضافة لدينا التفاصيل التقنية لكل طلب (مثل عنوان IP والمتصفح والوقت) لتقديم الصفحات والحفاظ على أمنها، وفق شروطهم.",
              "البريد الذي ترسلونه لنا: إذا كتبتم لنا، نحتفظ بالرسالة وبعنوانكم للرد عليكم، وما دام ذلك لازمًا لهذا الغرض.",
            ],
          },
          "لا تكتبوا في خانة البحث تفاصيل شخصية، مثل الأسماء أو أرقام الهوية أو الهواتف.",
        ],
      },
      {
        id: "cookies",
        title: "الكوكيز والتخزين بالمتصفح",
        blocks: [
          "الصفحات العامة لا تحفظ ملفات تعريف الارتباط (cookies)، ولا تستخدم التخزين المحلي في المتصفح، ولا تشغّل أدوات تحليل أو إعلانات أو تتبّع. الخطوط تُقدَّم من موقعنا، وقطع الخريطة تُحمَّل من خادم الخرائط الخاص بنا (tiles.darb.co.il، على Cloudflare).",
          "تُستخدم ملفات تعريف الارتباط فقط في منطقة الإدارة الخاصة بفريق درب (/admin)، لتسجيل الدخول عبر Clerk.",
        ],
      },
      {
        id: "purposes",
        title: "ليش منستعمل المعلومات",
        blocks: [
          {
            list: [
              "لتشغيل البحث وعرض النتائج.",
              "لإيجاد أماكن قريبة منكم، عندما تطلبون.",
              "للحماية من إساءة الاستخدام والحفاظ على أمن الخدمة.",
              "لتحسين جودة البحث والدليل.",
              "للرد على رسائلكم.",
            ],
          },
          "لا نبيع المعلومات، ولا نستخدمها للإعلانات، ولا نبني ملفات تعريفية للزوار.",
        ],
      },
      {
        id: "consent",
        title: "الأساس القانوني والموافقة",
        blocks: [
          "استخدام البحث والخريطة اختياري. يُستخدم الموقع الجغرافي فقط بموافقتكم في المتصفح، ويمكنكم سحب الموافقة في أي وقت من إعدادات المتصفح. أما باقي المعالجة فهي لازمة لتقديم الخدمة التي طلبتموها وللحفاظ على أمنها، كما هو موصوف في هذه السياسة.",
        ],
      },
      {
        id: "providers",
        title: "مزوّدي الخدمة ونقل المعلومات للخارج",
        blocks: [
          "نستعين بهؤلاء المزوّدين لتشغيل الخدمة، وبعضهم يعمل خارج إسرائيل. كل مزوّد يحصل فقط على ما يحتاجه:",
          {
            list: [
              "Vercel: استضافة الموقع.",
              "Railway: تشغيل الـ API وذاكرة Redis المؤقتة الخاصة به، في الاتحاد الأوروبي.",
              "Neon: قاعدة البيانات، في فرانكفورت، ألمانيا.",
              "Cloudflare: قطع الخريطة (تخزين R2)، ومنذ نقل النطاق أيضًا DNS.",
              "Anthropic (Claude): يتلقى نص البحث واللغة وقائمة بالفئات والأماكن المطابقة، لفهم ما تبحثون عنه. يُحفظ الجواب في الذاكرة المؤقتة حتى 7 أيام حسب نص البحث، دون أي تفصيل عنكم.",
              "Voyage AI: يتلقى نص البحث لحساب تمثيل رقمي (embedding) يساعد في ترتيب النتائج.",
              "Clerk: تسجيل دخول فريق درب إلى منطقة الإدارة فقط.",
              "بيانات الخريطة: © المساهمون في OpenStreetMap، عبر Protomaps.",
            ],
          },
          "تُنقل المعلومات إلى الخارج، ومن ذلك إلى الاتحاد الأوروبي والولايات المتحدة، وفق أنظمة حماية الخصوصية (نقل المعلومات إلى قواعد بيانات خارج حدود الدولة)، 5761-2001. ونختار مزوّدين يلتزمون بحماية المعلومات.",
        ],
      },
      {
        id: "retention",
        title: "لقديش منحتفظ بالمعلومات",
        blocks: [
          {
            list: [
              "سجلات البحث تُحذف تلقائيًا بعد 90 يومًا.",
              "عدّادات تحديد المعدل تُحذف بعد نحو دقيقة.",
              "موقعكم الجغرافي لا يُحفظ إطلاقًا.",
              "فهم البحث في الذاكرة المؤقتة، ولا يتضمن أي تفصيل عنكم، يُحفظ حتى 7 أيام.",
              "الرسائل بالبريد الإلكتروني تُحفظ ما دامت لازمة لمعالجتها.",
            ],
          },
        ],
      },
      {
        id: "security",
        title: "أمن المعلومات",
        blocks: [
          "المعلومات مشفّرة أثناء النقل (HTTPS). الوصول إلى قاعدة البيانات ومنطقة الإدارة محصور بفريق مخوَّل مع تسجيل دخول. المفاتيح والأسرار لا تُحفظ في الشيفرة. عناوين IP تُحوَّل إلى بصمة بمفتاح سري قبل العدّ. وتُرسَل الصفحات مع ترويسات أمان، منها سياسة أمان المحتوى (CSP).",
          "نعمل وفق أنظمة أمن المعلومات بالمستوى الملائم لقاعدة البيانات. لا يوجد نظام محمي بالكامل، وإذا وقع حادث أمني خطير، سنتصرف كما يُلزم القانون.",
        ],
      },
      {
        id: "rights",
        title: "حقوقكم",
        blocks: [
          "بحسب البند 13 من قانون حماية الخصوصية، يحق لكم الاطلاع على المعلومات المتعلقة بكم في قاعدة بياناتنا. وبحسب البند 14، يحق لكم طلب تصحيح أو حذف معلومات غير صحيحة أو غير كاملة أو غير واضحة أو غير محدَّثة.",
          "أرسلوا طلبكم إلى founder@darb.co.il، وسنرد خلال المدد التي يحددها القانون. سجلات البحث لا تتضمن تفاصيل تعريفية، لذلك لن نتمكن عادةً من ربط سجل بشخص معيّن، وإن كان الأمر كذلك سنخبركم.",
          "يمكنكم أيضًا التوجّه إلى سلطة حماية الخصوصية.",
        ],
      },
      {
        id: "businesses",
        title: "صفحات المصالح",
        blocks: [
          "تعرض صفحات المصالح معلومات تجارية عامة، مثل الاسم والعنوان والهاتف وساعات العمل والروابط والفئة. إذا كنتم أصحاب مصلحة تظهر على درب أو تمثّلونها وتريدون تصحيح تفاصيل أو حذفها، اكتبوا لنا.",
        ],
      },
      {
        id: "children",
        title: "الأولاد",
        blocks: [
          "درب دليل عام بلا حسابات، ولا نجمع عن علم معلومات عن الأطفال. إذا اعتقد أحد الوالدين أن طفلًا أرسل لنا معلومات شخصية، تواصلوا معنا وسنحذفها.",
        ],
      },
      {
        id: "changes",
        title: "تغييرات على السياسة",
        blocks: [
          "قد نحدّث هذه السياسة. يبيّن التاريخ في أعلى الصفحة موعد آخر تحديث، وسنشير في هذه الصفحة إلى أي تغيير جوهري.",
        ],
      },
      {
        id: "contact",
        title: "تواصلوا معنا",
        blocks: ["عندكم سؤال عن الخصوصية؟ اكتبوا لنور الدين موسى على founder@darb.co.il."],
      },
    ],
  },
  en: {
    title: "Privacy policy",
    lead: "Darb is a business directory you can use without an account. This policy explains what information the site handles when you use it, why, for how long, and what your rights are.",
    sections: [
      {
        id: "who",
        title: "Who we are",
        blocks: [
          "Darb (darb.co.il) is operated by Noor Alden Mousa, the founder of Darb, in Israel. He is responsible for the information described here (the database owner under the Protection of Privacy Law). Contact: founder@darb.co.il.",
          "This policy follows the Protection of Privacy Law, 5741-1981, including Amendment 13, in force since August 2025, and the Privacy Protection (Data Security) Regulations, 5777-2017.",
        ],
      },
      {
        id: "no-accounts",
        title: "No accounts for visitors",
        blocks: [
          "You do not need to sign up or sign in to use Darb. We do not ask for your name, phone number or email to search or browse. You are under no legal obligation to give us any information, and you only share what you choose to send, for example when you write to us.",
        ],
      },
      {
        id: "data",
        title: "What the site handles",
        blocks: [
          {
            list: [
              "Searches: when you search, we keep a record of the search text (up to 200 characters), the language, how the search was understood, how many results came back and, if you open a result within 24 hours, which one. The record does not include your IP address, device details, location or any account. We use it to improve search and to see which places and businesses people look for and do not find.",
              'Location for "Near me": only if you press "Near me" or sort by distance, and allow it in your browser. Your position is rounded to about 110 metres and sent in the body of the request to find nearby places and businesses. It is used for that request only, and it is not stored or logged.',
              "IP address for rate limits: to protect the service from abuse, your IP address is used to count requests per minute. The API counts a hash of the address made with a secret key, not the address itself, and the count is deleted after about a minute. The web server may hold the address in memory for a short time for the same purpose. It is never saved in the search record.",
              "Technical logs: as with any website, our hosting providers process the technical details of each request (such as IP address, browser and time) to deliver pages and keep them secure, under their own terms.",
              "Email you send us: if you write to us, we keep the message and your address to answer you, for as long as that requires.",
            ],
          },
          "Please do not type personal details, such as names, ID numbers or phone numbers, into the search box.",
        ],
      },
      {
        id: "cookies",
        title: "Cookies and browser storage",
        blocks: [
          "Public pages do not set cookies, do not use your browser's local storage and do not run analytics, advertising or tracking tools. Fonts are served from our own site, and map tiles load from our own map server (tiles.darb.co.il, on Cloudflare).",
          "Cookies are used only in the Darb staff admin area (/admin), for sign-in through Clerk.",
        ],
      },
      {
        id: "purposes",
        title: "Why we use information",
        blocks: [
          {
            list: [
              "To run search and show results.",
              "To find places near you, when you ask.",
              "To protect against abuse and keep the service secure.",
              "To improve the quality of search and of the directory.",
              "To answer your messages.",
            ],
          },
          "We do not sell information, use it for advertising or build profiles of visitors.",
        ],
      },
      {
        id: "consent",
        title: "Legal basis and consent",
        blocks: [
          "Using search and the map is voluntary. Your location is used only with your permission in the browser, and you can withdraw it at any time in your browser settings. The rest of the processing is needed to provide the service you asked for and to keep it secure, as this policy describes.",
        ],
      },
      {
        id: "providers",
        title: "Service providers and transfers abroad",
        blocks: [
          "We use these providers to run the service, and some of them operate outside Israel. Each receives only what it needs:",
          {
            list: [
              "Vercel: hosts the website.",
              "Railway: runs the API and its Redis cache, in the European Union.",
              "Neon: hosts the database, in Frankfurt, Germany.",
              "Cloudflare: map tiles (R2 storage) and, once the domain moves, DNS.",
              "Anthropic (Claude): receives the search text, its language and a list of matching categories and places, to understand what you are looking for. The answer is cached for up to 7 days by search text, with no detail about you.",
              "Voyage AI: receives the search text to compute a numeric representation (an embedding) that helps rank results.",
              "Clerk: sign-in for Darb staff to the admin area only.",
              "Map data: © OpenStreetMap contributors, through Protomaps.",
            ],
          },
          "Information is transferred abroad, including to the European Union and the United States, in line with the Privacy Protection (Transfer of Data to Databases Abroad) Regulations, 5761-2001. We choose providers that commit to protecting information.",
        ],
      },
      {
        id: "retention",
        title: "How long we keep it",
        blocks: [
          {
            list: [
              "Search records are deleted automatically after 90 days.",
              "Rate limit counts are deleted after about a minute.",
              "Your location is not stored at all.",
              "The cached understanding of a search, which holds no detail about you, is kept for up to 7 days.",
              "Emails are kept for as long as they are needed to deal with them.",
            ],
          },
        ],
      },
      {
        id: "security",
        title: "Security",
        blocks: [
          "Information is encrypted in transit (HTTPS). Access to the database and the admin area is limited to authorised staff who sign in. Keys and secrets are kept out of the code. IP addresses are hashed with a secret key before they are counted. Pages are sent with security headers, including a Content Security Policy (CSP).",
          "We follow the Data Security Regulations at the level suited to the database. No system is perfectly secure, and if a serious security incident happens, we will act as the law requires.",
        ],
      },
      {
        id: "rights",
        title: "Your rights",
        blocks: [
          "Under section 13 of the Protection of Privacy Law, you may see information about you held in our database. Under section 14, you may ask us to correct or delete information that is not correct, complete, clear or up to date.",
          "Send your request to founder@darb.co.il, and we will answer within the times set by law. Search records hold no identifying details, so we usually cannot link a record to a particular person. If that is the case, we will tell you.",
          "You may also contact the Privacy Protection Authority.",
        ],
      },
      {
        id: "businesses",
        title: "Business listings",
        blocks: [
          "Business pages show public business information, such as name, address, phone number, opening hours, links and category. If you own or represent a business listed on Darb and want details corrected or removed, write to us.",
        ],
      },
      {
        id: "children",
        title: "Children",
        blocks: [
          "Darb is a general directory with no accounts, and we do not knowingly collect information about children. If a parent believes a child has sent us personal information, contact us and we will delete it.",
        ],
      },
      {
        id: "changes",
        title: "Changes to this policy",
        blocks: [
          "We may update this policy. The date at the top of the page shows when it was last updated, and we will point out any significant change on this page.",
        ],
      },
      {
        id: "contact",
        title: "Contact",
        blocks: ["For any privacy question: Noor Alden Mousa, founder@darb.co.il."],
      },
    ],
  },
};

const terms: Record<Locale, LegalDoc> = {
  he: {
    title: "תנאי שימוש",
    lead: "התנאים האלה חלים על כל מי שמשתמש באתר darb.co.il. השימוש באתר הוא הסכמה להם, אז כדאי לקרוא אותם.",
    sections: [
      {
        id: "operator",
        title: "מי מפעיל את דרב",
        blocks: ["דרב מופעל על ידי נור אלדין מוסא, מייסד דרב, בישראל. לפניות: founder@darb.co.il."],
      },
      {
        id: "service",
        title: "השירות",
        blocks: [
          "דרב הוא מדריך עסקים בכל רחבי ישראל, בעברית, בערבית ובאנגלית. הוא כולל חיפוש חכם שמבין מה שאתם מקלידים, מפה ורשת של קטגוריות ועסקים, ותצוגה של אפליקציות לדוגמה ושל עבודות ללקוחות, שמראה מה דרב בונה לעסקים. השימוש במדריך חינם ולא דורש חשבון.",
        ],
      },
      {
        id: "accuracy",
        title: "המידע על עסקים",
        blocks: [
          "פרטי עסקים, כמו כתובות, טלפונים, שעות פתיחה, תפריטים, מחירים ושירותים, עשויים להשתנות, וחלקם מגיעים ממקורות ציבוריים. אנחנו עובדים כדי שיהיו מעודכנים, אבל לא יכולים להבטיח שהם מלאים או מדויקים.",
          "שעות הפתיחה והסימון ״פתוח עכשיו״ הם לשם מידע בלבד. כדאי לבדוק מול העסק לפני שיוצאים, במיוחד בחגים.",
          "תוצאות החיפוש והסדר שלהן נוצרים אוטומטית ואינם המלצה. הופעה של עסק בדרב אינה המלצה עליו.",
        ],
      },
      {
        id: "links",
        title: "קישורים ואתרים של לקוחות",
        blocks: [
          "האתר מקשר לאתרים אחרים, כולל לאפליקציות שדרב בנה לעסקים. האתרים האלה מופעלים על ידי העסקים עצמם, לפי התנאים ומדיניות הפרטיות שלהם, ואנחנו לא אחראים לתוכן שלהם או לעסקאות שתעשו בהם. מסכי הדוגמה בתצוגה ממחישים את סוג האפליקציות שאנחנו בונים.",
        ],
      },
      {
        id: "use",
        title: "שימוש מותר",
        blocks: [
          "בבקשה אל:",
          {
            list: [
              "תעתיקו או תאספו את המדריך בכמויות בכלים אוטומטיים (scraping או זחלנים), מעבר למה שקובץ robots.txt מתיר.",
              "תשלחו בקשות שמעמיסות על השירות או שעוקפות את הגבלות הקצב.",
              "תנסו לחדור, לסרוק או להפריע לאתר, ל-API או לאזור הניהול.",
              "תשתמשו באתר למשהו לא חוקי או כדי לפגוע באחרים.",
              "תקלידו בחיפוש פרטים אישיים של אנשים אחרים.",
            ],
          },
          "אנחנו רשאים לחסום גישה שמפרה את הכללים האלה. מנועי חיפוש מוזמנים לסרוק את האתר לפי robots.txt.",
        ],
      },
      {
        id: "ip",
        title: "קניין רוחני",
        blocks: [
          "השם דרב, הלוגו, העיצוב, הטקסטים והקוד של האתר שייכים לדרב. האפליקציות של הלקוחות והתוכן שלהן שייכים לבעליהן. שמות וסימנים של עסקים שייכים לעסקים.",
          "נתוני המפה: © תורמי OpenStreetMap, ואריחי המפה דרך Protomaps, לפי הרישיונות שלהם.",
          "מותר לצטט קטעים קצרים עם קרדיט. כל שימוש אחר דורש אישור מאיתנו.",
        ],
      },
      {
        id: "business-services",
        title: "שירותים בתשלום לעסקים",
        blocks: [
          "דרב בונה גם אפליקציות ווב ואפליקציות נייטיב לעסקים. המסלולים והמחירים מופיעים בעמוד המחירים, ועבודה בהתאמה אישית מוסכמת בנפרד ובכתב. שירותים בתשלום כפופים להסכם שנחתם עליהם, ואם יש סתירה, ההסכם קובע.",
        ],
      },
      {
        id: "liability",
        title: "אחריות",
        blocks: [
          "אנחנו מספקים את האתר כפי שהוא ופועלים כדי שיהיה זמין ונכון, אבל לפעמים הוא עלול להיות לא זמין או לכלול טעויות. ככל שהחוק מתיר, דרב לא אחראי לנזק שנגרם מהסתמכות על מידע על עסקים, מאתרים של צד שלישי או מהפסקות בשירות.",
          "שום דבר בתנאים האלה לא מגביל זכויות שיש לכם לפי חוק הגנת הצרכן, התשמ״א-1981, או לפי כל דין אחר שאי אפשר לוותר עליו, ולא מגביל את האחריות שלנו במקרים שבהם החוק אוסר להגביל אותה.",
        ],
      },
      {
        id: "changes",
        title: "שינויים בתנאים",
        blocks: [
          "אנחנו עשויים לעדכן את התנאים. התאריך בראש העמוד מראה מתי הם עודכנו, ושינוי מהותי נציין בעמוד הזה. המשך השימוש באתר אחרי עדכון הוא הסכמה לתנאים המעודכנים.",
        ],
      },
      {
        id: "law",
        title: "הדין החל",
        blocks: [
          "על התנאים ועל השימוש באתר חלים דיני מדינת ישראל, ובתי המשפט המוסמכים בישראל הם שידונו בכל עניין הקשור אליהם.",
        ],
      },
      {
        id: "contact",
        title: "יצירת קשר",
        blocks: ["לכל שאלה על התנאים: נור אלדין מוסא, founder@darb.co.il."],
      },
    ],
  },
  ar: {
    title: "شروط الاستخدام",
    lead: "هاي الشروط بتنطبق على كل مين بيستعمل موقع darb.co.il. استعمال الموقع معناه إنكم موافقين عليها، فمنصحكم تقرأوها.",
    sections: [
      {
        id: "operator",
        title: "مين بيدير درب",
        blocks: ["يدير درب نور الدين موسى، مؤسس درب، في إسرائيل. للتواصل: founder@darb.co.il."],
      },
      {
        id: "service",
        title: "الخدمة",
        blocks: [
          "درب دليل للمصالح في جميع أنحاء إسرائيل، بالعربية والعبرية والإنجليزية. يتضمن بحثًا ذكيًا يفهم ما تكتبونه، وخريطة وشبكة للفئات والمصالح، ومعرضًا لتطبيقات نموذجية ولأعمال لزبائننا يُظهر ما يبنيه درب للمصالح. استخدام الدليل مجاني ولا يحتاج إلى حساب.",
        ],
      },
      {
        id: "accuracy",
        title: "المعلومات عن المصالح",
        blocks: [
          "تفاصيل المصالح، مثل العناوين والهواتف وساعات العمل وقوائم الطعام والأسعار والخدمات، قد تتغير، وبعضها مصدره معلومات عامة. نعمل على تحديثها، لكن لا يمكننا ضمان أنها كاملة أو دقيقة.",
          "ساعات العمل وإشارة «مفتوح الآن» للمعلومات فقط. ننصح بالتأكد من المصلحة قبل الذهاب، خاصة في الأعياد.",
          "نتائج البحث وترتيبها تُنتَج تلقائيًا وليست توصية. وظهور مصلحة على درب ليس توصية بها.",
        ],
      },
      {
        id: "links",
        title: "الروابط ومواقع الزبائن",
        blocks: [
          "يربط الموقع بمواقع أخرى، منها تطبيقات بناها درب لمصالح. هذه المواقع تديرها المصالح نفسها، وفق شروطها وسياسات الخصوصية الخاصة بها، ولسنا مسؤولين عن محتواها أو عن أي معاملات تجرونها فيها. شاشات النماذج في المعرض توضح نوع التطبيقات التي نبنيها.",
        ],
      },
      {
        id: "use",
        title: "شو ممنوع",
        blocks: [
          "رجاءً لا:",
          {
            list: [
              "تنسخوا الدليل أو تجمعوه بكميات بأدوات آلية (scraping أو زواحف)، بما يتجاوز ما يسمح به ملف robots.txt.",
              "ترسلوا طلبات تُثقل الخدمة أو تتجاوز حدود معدل الطلبات.",
              "تحاولوا اختراق الموقع أو الـ API أو منطقة الإدارة أو فحصها أو التشويش عليها.",
              "تستخدموا الموقع لأي أمر غير قانوني أو لإيذاء الآخرين.",
              "تكتبوا في البحث تفاصيل شخصية لأشخاص آخرين.",
            ],
          },
          "يحق لنا حجب أي وصول يخالف هذه القواعد. محركات البحث مرحَّب بها لفهرسة الموقع وفق robots.txt.",
        ],
      },
      {
        id: "ip",
        title: "الملكية الفكرية",
        blocks: [
          "اسم درب وشعاره وتصميم الموقع ونصوصه وشيفرته ملك لدرب. تطبيقات الزبائن ومحتواها ملك لأصحابها. أسماء المصالح وعلاماتها ملك لتلك المصالح.",
          "بيانات الخريطة: © المساهمون في OpenStreetMap، وقطع الخريطة عبر Protomaps، وفق تراخيصها.",
          "يُسمح باقتباس مقاطع قصيرة مع ذكر المصدر. أي استخدام آخر يحتاج إلى إذن منا.",
        ],
      },
      {
        id: "business-services",
        title: "خدمات مدفوعة للمصالح",
        blocks: [
          "يبني درب أيضًا تطبيقات ويب وتطبيقات أصلية للمصالح. الباقات والأسعار معروضة في صفحة الأسعار، والعمل حسب الطلب يُتفق عليه بشكل منفصل وكتابيًا. تخضع الخدمات المدفوعة للاتفاق الموقّع عليها، وفي حال التعارض، يسري الاتفاق.",
        ],
      },
      {
        id: "liability",
        title: "المسؤولية",
        blocks: [
          "نقدّم الموقع كما هو ونعمل لكي يكون متاحًا وصحيحًا، لكنه قد يكون أحيانًا غير متاح أو يتضمن أخطاء. وبالقدر الذي يسمح به القانون، لا يتحمل درب المسؤولية عن ضرر ناتج عن الاعتماد على معلومات المصالح، أو عن مواقع طرف ثالث، أو عن انقطاع الخدمة.",
          "لا شيء في هذه الشروط يقيّد حقوقًا لكم بموجب قانون حماية المستهلك، 5741-1981، أو أي قانون آخر لا يجوز التنازل عنه، ولا يقيّد مسؤوليتنا في الحالات التي يمنع فيها القانون تقييدها.",
        ],
      },
      {
        id: "changes",
        title: "تغييرات على الشروط",
        blocks: [
          "قد نحدّث هذه الشروط. يبيّن التاريخ في أعلى الصفحة موعد آخر تحديث، وسنشير في هذه الصفحة إلى أي تغيير جوهري. استمرار استخدام الموقع بعد التحديث يعني الموافقة على الشروط المحدَّثة.",
        ],
      },
      {
        id: "law",
        title: "القانون اللي بيسري",
        blocks: [
          "تسري قوانين دولة إسرائيل على هذه الشروط وعلى استخدام الموقع، وتختص المحاكم المختصة في إسرائيل بالنظر في أي أمر يتعلق بها.",
        ],
      },
      {
        id: "contact",
        title: "تواصلوا معنا",
        blocks: ["عندكم سؤال عن الشروط؟ اكتبوا لنور الدين موسى على founder@darb.co.il."],
      },
    ],
  },
  en: {
    title: "Terms of use",
    lead: "These terms apply to everyone who uses darb.co.il. Using the site means you accept them, so please read them.",
    sections: [
      {
        id: "operator",
        title: "Who operates Darb",
        blocks: [
          "Darb is operated by Noor Alden Mousa, the founder of Darb, in Israel. Contact: founder@darb.co.il.",
        ],
      },
      {
        id: "service",
        title: "The service",
        blocks: [
          "Darb is a directory of businesses across Israel, in Hebrew, Arabic and English. It includes a smart search that understands what you type, a map and a grid of categories and businesses, and a showroom of example apps and client work that shows what Darb builds for businesses. Using the directory is free and needs no account.",
        ],
      },
      {
        id: "accuracy",
        title: "Information about businesses",
        blocks: [
          "Business details, such as addresses, phone numbers, opening hours, menus, prices and services, may change, and some of them come from public sources. We work to keep them up to date, but we cannot guarantee that they are complete or accurate.",
          'Opening hours and the "open now" label are for information only. Please check with the business before you go, especially on holidays.',
          "Search results and their order are produced automatically and are not a recommendation. A business appearing on Darb is not an endorsement of it.",
        ],
      },
      {
        id: "links",
        title: "Links and client sites",
        blocks: [
          "The site links to other sites, including apps Darb built for businesses. Those sites are run by the businesses themselves, under their own terms and privacy policies, and we are not responsible for their content or for any transaction you make with them. The example screens in the showroom illustrate the kind of apps we build.",
        ],
      },
      {
        id: "use",
        title: "Acceptable use",
        blocks: [
          "Please do not:",
          {
            list: [
              "Copy or collect the directory in bulk with automated tools (scraping or crawlers), beyond what robots.txt allows.",
              "Send requests that overload the service or get around its rate limits.",
              "Try to break into, probe or interfere with the site, the API or the admin area.",
              "Use the site for anything unlawful or to harm others.",
              "Type other people's personal details into search.",
            ],
          },
          "We may block access that breaks these rules. Search engines are welcome to crawl the site as robots.txt allows.",
        ],
      },
      {
        id: "ip",
        title: "Intellectual property",
        blocks: [
          "The Darb name, logo, design, text and code belong to Darb. Client apps and their content belong to their owners. Business names and marks belong to those businesses.",
          "Map data: © OpenStreetMap contributors, with map tiles through Protomaps, under their licences.",
          "You may quote short passages with credit. Any other use needs our permission.",
        ],
      },
      {
        id: "business-services",
        title: "Paid services for businesses",
        blocks: [
          "Darb also builds web apps and native apps for businesses. Plans and prices are shown on the pricing page, and custom work is agreed separately in writing. Paid services are governed by the agreement signed for them, and if there is a conflict, that agreement prevails.",
        ],
      },
      {
        id: "liability",
        title: "Liability",
        blocks: [
          "We provide the site as it is and work to keep it available and correct, but at times it may be unavailable or contain errors. As far as the law allows, Darb is not liable for damage caused by relying on business information, by third-party sites or by interruptions to the service.",
          "Nothing in these terms limits any right you have under the Consumer Protection Law, 5741-1981, or any other law that cannot be waived, or our liability where the law does not allow it to be limited.",
        ],
      },
      {
        id: "changes",
        title: "Changes to these terms",
        blocks: [
          "We may update these terms. The date at the top of the page shows when they were last updated, and we will point out any significant change on this page. Using the site after an update means you accept the updated terms.",
        ],
      },
      {
        id: "law",
        title: "Governing law",
        blocks: [
          "These terms and the use of the site are governed by the laws of the State of Israel, and the competent courts in Israel will hear any matter related to them.",
        ],
      },
      {
        id: "contact",
        title: "Contact",
        blocks: ["For any question about these terms: Noor Alden Mousa, founder@darb.co.il."],
      },
    ],
  },
};

export const legal: Record<LegalKind, Record<Locale, LegalDoc>> = {
  accessibility,
  terms,
  privacy,
};
