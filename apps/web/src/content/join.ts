import type { Locale } from "@darb/core";

/** Everything the /join form says: passed to the client component as it is. */
export interface JoinCopy {
  title: string;
  lead: string;
  find: {
    label: string;
    hint: string;
    search: string;
    here: string;
    manual: string;
    /** Shown one after another while the lookup runs. */
    progress: [string, string, string];
    locating: string;
    noLocation: string;
    none: string;
    off: string;
    excluded: string;
    tooMany: string;
    failed: string;
    empty: string;
  };
  check: {
    title: string;
    lead: string;
    foundOn: string;
    osm: string;
    back: string;
    business: string;
    name: string;
    nameHint: string;
    nameOther: string;
    type: string;
    typeSearch: string;
    town: string;
    townSearch: string;
    noMatch: string;
    location: string;
    locationHint: string;
    address: string;
    contact: string;
    phone: string;
    whatsapp: string;
    sameAsPhone: string;
    links: string;
    website: string;
    instagram: string;
    facebook: string;
    tiktok: string;
    handleHint: string;
    hours: string;
    description: string;
    descriptionHint: string;
    photos: string;
    photosHint: string;
    logo: string;
    addLogo: string;
    addPhotos: string;
    uploading: string;
    remove: string;
    moveFirst: string;
    style: string;
    accent: string;
    icons: string;
    iconsLine: string;
    iconsSolid: string;
    owner: string;
    ownerHint: string;
    ownerName: string;
    ownerPhone: string;
    ownerEmail: string;
    note: string;
    optional: string;
    send: string;
    sending: string;
  };
  hours: {
    days: [string, string, string, string, string, string, string];
    open: string;
    from: string;
    to: string;
    presets: string;
    sunThu: string;
    everyDay: string;
    allDay: string;
    copyAll: string;
  };
  preview: {
    title: string;
    openNow: string;
    closedNow: string;
    call: string;
    whatsapp: string;
    waze: string;
    website: string;
    instagram: string;
    facebook: string;
    tiktok: string;
    yourName: string;
  };
  done: { title: string; body: string; home: string };
  errors: {
    fix: string;
    name: string;
    kind: string;
    place: string;
    point: string;
    phone: string;
    whatsapp: string;
    website: string;
    instagram: string;
    facebook: string;
    tiktok: string;
    hours: string;
    ownerName: string;
    ownerPhone: string;
    ownerEmail: string;
    photoType: string;
    photoBig: string;
    photoFailed: string;
    tooMany: string;
    failed: string;
  };
  map: {
    map: string;
    pin: string;
    hint: string;
    centre: string;
    locate: string;
    locating: string;
    noLocation: string;
    outside: string;
    editNumbers: string;
    lat: string;
    lng: string;
    noMap: string;
    mapData: string;
    gestures: { windows: string; mac: string; mobile: string };
  };
}

export const join: Record<Locale, JoinCopy> = {
  he: {
    title: "שימו את העסק שלכם על דרב",
    lead: "כמה שניות ויש לכם כרטיס עסק עם הקישורים, ווייז ושעות הפתיחה. אנחנו בודקים ומפרסמים.",
    find: {
      label: "שם העסק והעיר, או קישור",
      hint: "אפשר להדביק קישור מגוגל מפות, ווייז, אינסטגרם או פייסבוק.",
      search: "חיפוש",
      here: "אני בעסק עכשיו",
      manual: "אמלא בעצמי",
      progress: ["מסתכלים על המפה...", "קוראים את העמוד שלכם...", "כותבים את הכרטיס..."],
      locating: "מאתרים איפה אתם...",
      noLocation: "לא הצלחנו לקבל את המיקום. אפשר לחפש לפי שם או למלא בעצמכם.",
      none: "לא מצאנו את העסק. מלאו את הפרטים, זה לוקח שתי דקות.",
      off: "החיפוש החכם לא זמין כרגע. מלאו את הפרטים, זה לוקח שתי דקות.",
      excluded: "דרב לא מציג עסקים מהסוג הזה.",
      tooMany: "חיפשתם כבר כמה פעמים. מלאו את הפרטים בעצמכם, או נסו שוב בעוד שעה.",
      failed: "החיפוש לא הצליח. נסו שוב או מלאו בעצמכם.",
      empty: "כתבו שם ועיר, או הדביקו קישור.",
    },
    check: {
      title: "בדקו את הכרטיס",
      lead: "מילאנו מה שמצאנו. תקנו מה שצריך והוסיפו מה שחסר.",
      foundOn: "נמצא ב:",
      osm: "נתוני כתובת © OpenStreetMap",
      back: "חיפוש אחר",
      business: "העסק",
      name: "שם העסק",
      nameHint: "מספיק בשפה אחת. את השאר נוסיף אנחנו.",
      nameOther: "השם בשפות נוספות",
      type: "סוג העסק",
      typeSearch: "חפשו סוג, למשל מספרה",
      town: "עיר או יישוב",
      townSearch: "חפשו עיר",
      noMatch: "לא נמצא. נסו מילה אחרת.",
      location: "איפה העסק",
      locationHint: "גררו את הסיכה בדיוק לכניסה.",
      address: "כתובת",
      contact: "יצירת קשר",
      phone: "טלפון",
      whatsapp: "וואטסאפ",
      sameAsPhone: "אותו מספר כמו הטלפון",
      links: "קישורים",
      website: "אתר",
      instagram: "אינסטגרם",
      facebook: "פייסבוק",
      tiktok: "טיקטוק",
      handleHint: "שם משתמש או קישור.",
      hours: "שעות פתיחה",
      description: "כמה מילים על העסק",
      descriptionHint: "בכל שפה. משפט או שניים.",
      photos: "תמונות",
      photosHint: "לוגו ועד 6 תמונות. JPG, PNG או WebP, עד 8MB.",
      logo: "לוגו",
      addLogo: "הוספת לוגו",
      addPhotos: "הוספת תמונות",
      uploading: "מעלים...",
      remove: "הסרה",
      moveFirst: "להציג ראשונה",
      style: "המראה של הכרטיס",
      accent: "צבע",
      icons: "אייקונים",
      iconsLine: "קו",
      iconsSolid: "מלא",
      owner: "הפרטים שלכם",
      ownerHint: "רק דרב רואה את זה, כדי לוודא שזה אתם.",
      ownerName: "השם שלכם",
      ownerPhone: "הטלפון שלכם",
      ownerEmail: "אימייל",
      note: "משהו שכדאי שנדע?",
      optional: "לא חובה",
      send: "שליחה לבדיקה",
      sending: "שולחים...",
    },
    hours: {
      days: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
      open: "פתוח",
      from: "מ",
      to: "עד",
      presets: "מילוי מהיר",
      sunThu: "א׳ עד ה׳ 9 עד 18, שישי 9 עד 14",
      everyDay: "כל יום 9 עד 18",
      allDay: "24 שעות",
      copyAll: "להעתיק לכל הימים",
    },
    preview: {
      title: "ככה זה ייראה",
      openNow: "פתוח עכשיו",
      closedNow: "סגור עכשיו",
      call: "התקשרות",
      whatsapp: "וואטסאפ",
      waze: "ווייז",
      website: "אתר",
      instagram: "אינסטגרם",
      facebook: "פייסבוק",
      tiktok: "טיקטוק",
      yourName: "שם העסק",
    },
    done: {
      title: "תודה! קיבלנו.",
      body: "נבדוק ונפרסם את הכרטיס שלכם בקרוב. ייתכן שנתקשר כדי לוודא.",
      home: "חזרה לדף הבית",
    },
    errors: {
      fix: "יש כמה דברים לתקן לפני השליחה.",
      name: "כתבו את שם העסק.",
      kind: "בחרו את סוג העסק.",
      place: "בחרו עיר או יישוב.",
      point: "שימו את הסיכה על המפה.",
      phone: "מספר טלפון לא תקין.",
      whatsapp: "מספר וואטסאפ לא תקין.",
      website: "כתובת אתר לא תקינה.",
      instagram: "זה לא נראה כמו אינסטגרם.",
      facebook: "זה לא נראה כמו פייסבוק.",
      tiktok: "זה לא נראה כמו טיקטוק.",
      hours: "בדקו את השעות: כל יום פתוח צריך שעת פתיחה וסגירה.",
      ownerName: "כתבו את השם שלכם.",
      ownerPhone: "כתבו טלפון שנוכל לחזור אליו.",
      ownerEmail: "כתובת אימייל לא תקינה.",
      photoType: "אפשר להעלות רק תמונות.",
      photoBig: "התמונה גדולה מדי, עד 8MB.",
      photoFailed: "התמונה לא עלתה. נסו שוב.",
      tooMany: "שלחתם כבר כמה טפסים. נסו שוב בעוד שעה.",
      failed: "לא הצלחנו לשלוח. הכל עדיין כאן, נסו שוב.",
    },
    map: {
      map: "מפה לבחירת המיקום",
      pin: "מיקום העסק",
      hint: "גררו את הסיכה או הקישו על המפה.",
      centre: "למרכז את הסיכה",
      locate: "המיקום שלי",
      locating: "מאתרים...",
      noLocation: "לא הצלחנו לקבל את המיקום.",
      outside: "הנקודה מחוץ לישראל.",
      editNumbers: "עריכת קואורדינטות",
      lat: "קו רוחב",
      lng: "קו אורך",
      noMap: "המפה לא נטענה. אפשר לכתוב קואורדינטות או להשתמש במיקום שלכם.",
      mapData: "נתוני מפה",
      gestures: {
        windows: "Ctrl וגלגלת כדי להתקרב",
        mac: "⌘ וגלגלת כדי להתקרב",
        mobile: "שתי אצבעות כדי להזיז את המפה",
      },
    },
  },
  ar: {
    title: "حط مصلحتك على درب",
    lead: "بكم ثانية بصير عندك كرت للمصلحة فيه الروابط، ويز وساعات الدوام. إحنا منفحص ومننشر.",
    find: {
      label: "اسم المصلحة والبلد، أو رابط",
      hint: "فيك تلزق رابط من خرائط جوجل، ويز، إنستغرام أو فيسبوك.",
      search: "دوّر",
      here: "أنا بالمصلحة هلقيت",
      manual: "بعبّي لحالي",
      progress: ["عم نطلع عالخريطة...", "عم نقرا صفحتك...", "عم نكتب الكرت..."],
      locating: "عم نلاقي وينك...",
      noLocation: "ما قدرنا ناخد الموقع. فيك تدوّر بالاسم أو تعبّي لحالك.",
      none: "ما لقينا المصلحة. عبّي التفاصيل، بتاخد دقيقتين.",
      off: "البحث الذكي مش شغال هلقيت. عبّي التفاصيل، بتاخد دقيقتين.",
      excluded: "درب ما بعرض مصالح من هالنوع.",
      tooMany: "دوّرت كم مرة. عبّي لحالك، أو جرّب كمان ساعة.",
      failed: "البحث ما زبط. جرّب كمان مرة أو عبّي لحالك.",
      empty: "اكتب اسم وبلد، أو لزّق رابط.",
    },
    check: {
      title: "شيّك على الكرت",
      lead: "عبّينا اللي لقيناه. صلّح اللي بدها تصليح وزيد اللي ناقص.",
      foundOn: "لقيناه على:",
      osm: "معلومات العنوان © OpenStreetMap",
      back: "دوّر من جديد",
      business: "المصلحة",
      name: "اسم المصلحة",
      nameHint: "بكفي بلغة وحدة. الباقي منزيده إحنا.",
      nameOther: "الاسم بلغات تانية",
      type: "نوع المصلحة",
      typeSearch: "دوّر على نوع، مثلًا حلاق",
      town: "البلد",
      townSearch: "دوّر على بلد",
      noMatch: "ما لقينا. جرّب كلمة تانية.",
      location: "وين المصلحة",
      locationHint: "اسحب الدبوس بالزبط عالمدخل.",
      address: "العنوان",
      contact: "التواصل",
      phone: "تلفون",
      whatsapp: "واتساب",
      sameAsPhone: "نفس رقم التلفون",
      links: "روابط",
      website: "موقع",
      instagram: "إنستغرام",
      facebook: "فيسبوك",
      tiktok: "تيك توك",
      handleHint: "اسم المستخدم أو رابط.",
      hours: "ساعات الدوام",
      description: "كم كلمة عن المصلحة",
      descriptionHint: "بأي لغة. جملة أو جملتين.",
      photos: "صور",
      photosHint: "لوغو ولحد 6 صور. JPG أو PNG أو WebP، لحد 8MB.",
      logo: "لوغو",
      addLogo: "زيد لوغو",
      addPhotos: "زيد صور",
      uploading: "عم نرفع...",
      remove: "شيل",
      moveFirst: "خليها الأولى",
      style: "شكل الكرت",
      accent: "اللون",
      icons: "الأيقونات",
      iconsLine: "خط",
      iconsSolid: "معبّاية",
      owner: "تفاصيلك",
      ownerHint: "بس درب بشوفها، عشان نتأكد إنه إنت.",
      ownerName: "اسمك",
      ownerPhone: "تلفونك",
      ownerEmail: "إيميل",
      note: "في إشي لازم نعرفه؟",
      optional: "مش ضروري",
      send: "ابعث للفحص",
      sending: "عم نبعث...",
    },
    hours: {
      days: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
      open: "فاتح",
      from: "من",
      to: "لـ",
      presets: "تعبئة سريعة",
      sunThu: "أحد لخميس 9 لـ 18، جمعة 9 لـ 14",
      everyDay: "كل يوم 9 لـ 18",
      allDay: "24 ساعة",
      copyAll: "انسخ لكل الأيام",
    },
    preview: {
      title: "هيك رح يبيّن",
      openNow: "فاتح هلقيت",
      closedNow: "مسكّر هلقيت",
      call: "اتصال",
      whatsapp: "واتساب",
      waze: "ويز",
      website: "موقع",
      instagram: "إنستغرام",
      facebook: "فيسبوك",
      tiktok: "تيك توك",
      yourName: "اسم المصلحة",
    },
    done: {
      title: "شكرًا! وصلتنا.",
      body: "رح نشيّك وننشر الكرت تبعك قريب. ممكن نتصل نتأكد.",
      home: "ارجع للصفحة الرئيسية",
    },
    errors: {
      fix: "في كم إشي لازم يتصلّح قبل ما تبعث.",
      name: "اكتب اسم المصلحة.",
      kind: "اختار نوع المصلحة.",
      place: "اختار البلد.",
      point: "حط الدبوس عالخريطة.",
      phone: "رقم التلفون مش مزبوط.",
      whatsapp: "رقم الواتساب مش مزبوط.",
      website: "عنوان الموقع مش مزبوط.",
      instagram: "هاد ما بيّن إنستغرام.",
      facebook: "هاد ما بيّن فيسبوك.",
      tiktok: "هاد ما بيّن تيك توك.",
      hours: "شيّك عالساعات: كل يوم فاتح بدو ساعة فتح وسكّير.",
      ownerName: "اكتب اسمك.",
      ownerPhone: "اكتب تلفون نقدر نرجعلك عليه.",
      ownerEmail: "الإيميل مش مزبوط.",
      photoType: "بس صور بتنرفع.",
      photoBig: "الصورة كبيرة كثير، لحد 8MB.",
      photoFailed: "الصورة ما انرفعت. جرّب كمان مرة.",
      tooMany: "بعثت كم طلب. جرّب كمان ساعة.",
      failed: "ما قدرنا نبعث. كل إشي لسا هون، جرّب كمان مرة.",
    },
    map: {
      map: "خريطة لاختيار الموقع",
      pin: "موقع المصلحة",
      hint: "اسحب الدبوس أو اكبس عالخريطة.",
      centre: "رجّع الدبوس للنص",
      locate: "موقعي",
      locating: "عم نلاقي...",
      noLocation: "ما قدرنا ناخد الموقع.",
      outside: "النقطة برّا البلاد.",
      editNumbers: "عدّل الإحداثيات",
      lat: "خط العرض",
      lng: "خط الطول",
      noMap: "الخريطة ما فتحت. فيك تكتب الإحداثيات أو تستعمل موقعك.",
      mapData: "معلومات الخريطة",
      gestures: {
        windows: "Ctrl والعجلة عشان تقرّب",
        mac: "⌘ والعجلة عشان تقرّب",
        mobile: "إصبعين عشان تحرّك الخريطة",
      },
    },
  },
  en: {
    title: "Put your business on Darb",
    lead: "A few seconds and you have a business card with your links, Waze and opening hours. We check it and publish it.",
    find: {
      label: "Business name and town, or a link",
      hint: "You can paste a Google Maps, Waze, Instagram or Facebook link.",
      search: "Search",
      here: "I'm at my business now",
      manual: "Fill it in myself",
      progress: ["Looking at the map...", "Reading your page...", "Writing your card..."],
      locating: "Finding where you are...",
      noLocation: "We couldn't get your location. Search by name or fill it in yourself.",
      none: "We couldn't find it. Fill in the details, it takes two minutes.",
      off: "Smart search is off right now. Fill in the details, it takes two minutes.",
      excluded: "Darb doesn't list this kind of business.",
      tooMany: "You've searched a few times. Fill it in yourself, or try again in an hour.",
      failed: "The search didn't work. Try again or fill it in yourself.",
      empty: "Write a name and town, or paste a link.",
    },
    check: {
      title: "Check your card",
      lead: "We filled in what we found. Fix what needs fixing and add what's missing.",
      foundOn: "Found on:",
      osm: "Address data © OpenStreetMap",
      back: "Search again",
      business: "Business",
      name: "Business name",
      nameHint: "One language is enough. We'll add the rest.",
      nameOther: "The name in other languages",
      type: "Type of business",
      typeSearch: "Search a type, like barber",
      town: "Town",
      townSearch: "Search a town",
      noMatch: "Nothing found. Try another word.",
      location: "Where it is",
      locationHint: "Drag the pin right to the entrance.",
      address: "Address",
      contact: "Contact",
      phone: "Phone",
      whatsapp: "WhatsApp",
      sameAsPhone: "Same as the phone",
      links: "Links",
      website: "Website",
      instagram: "Instagram",
      facebook: "Facebook",
      tiktok: "TikTok",
      handleHint: "Username or link.",
      hours: "Opening hours",
      description: "A few words about the business",
      descriptionHint: "In any language. A sentence or two.",
      photos: "Photos",
      photosHint: "A logo and up to 6 photos. JPG, PNG or WebP, up to 8 MB.",
      logo: "Logo",
      addLogo: "Add a logo",
      addPhotos: "Add photos",
      uploading: "Uploading...",
      remove: "Remove",
      moveFirst: "Show first",
      style: "Your card's look",
      accent: "Colour",
      icons: "Icons",
      iconsLine: "Line",
      iconsSolid: "Solid",
      owner: "Your details",
      ownerHint: "Only Darb sees this, to confirm it's you.",
      ownerName: "Your name",
      ownerPhone: "Your phone",
      ownerEmail: "Email",
      note: "Anything we should know?",
      optional: "optional",
      send: "Send for review",
      sending: "Sending...",
    },
    hours: {
      days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      open: "Open",
      from: "From",
      to: "To",
      presets: "Quick fill",
      sunThu: "Sun to Thu 9 to 18, Fri 9 to 14",
      everyDay: "Every day 9 to 18",
      allDay: "24 hours",
      copyAll: "Copy to all days",
    },
    preview: {
      title: "How it will look",
      openNow: "Open now",
      closedNow: "Closed now",
      call: "Call",
      whatsapp: "WhatsApp",
      waze: "Waze",
      website: "Website",
      instagram: "Instagram",
      facebook: "Facebook",
      tiktok: "TikTok",
      yourName: "Your business",
    },
    done: {
      title: "Thanks! We got it.",
      body: "We'll check and publish your card soon. We may call to confirm.",
      home: "Back to the home page",
    },
    errors: {
      fix: "A few things need fixing before you send.",
      name: "Write the business's name.",
      kind: "Pick the type of business.",
      place: "Pick a town.",
      point: "Put the pin on the map.",
      phone: "That phone number doesn't look right.",
      whatsapp: "That WhatsApp number doesn't look right.",
      website: "That web address doesn't look right.",
      instagram: "That doesn't look like Instagram.",
      facebook: "That doesn't look like Facebook.",
      tiktok: "That doesn't look like TikTok.",
      hours: "Check the hours: each open day needs an opening and a closing time.",
      ownerName: "Write your name.",
      ownerPhone: "Write a phone we can call back.",
      ownerEmail: "That email doesn't look right.",
      photoType: "Only images can be uploaded.",
      photoBig: "That image is too big, up to 8 MB.",
      photoFailed: "That image didn't upload. Try again.",
      tooMany: "You've sent a few forms already. Try again in an hour.",
      failed: "We couldn't send it. Everything is still here, try again.",
    },
    map: {
      map: "Map to choose the location",
      pin: "The business's location",
      hint: "Drag the pin or tap the map.",
      centre: "Centre the pin",
      locate: "My location",
      locating: "Locating...",
      noLocation: "We couldn't get your location.",
      outside: "That point is outside Israel.",
      editNumbers: "Edit coordinates",
      lat: "Latitude",
      lng: "Longitude",
      noMap: "The map didn't load. Write coordinates or use your location.",
      mapData: "Map data",
      gestures: {
        windows: "Ctrl and scroll to zoom",
        mac: "⌘ and scroll to zoom",
        mobile: "Two fingers to move the map",
      },
    },
  },
};
