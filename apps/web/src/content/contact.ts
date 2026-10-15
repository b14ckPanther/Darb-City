import type { InquiryTopic } from "@darb/contracts";
import type { Locale } from "@darb/core";

export interface ContactCopy {
  title: string;
  lead: string;
  instagramLine: string;
  form: ContactFormCopy;
}

/** Everything the form says: passed to the client component as it is. */
export interface ContactFormCopy {
  name: string;
  contact: string;
  contactHint: string;
  business: string;
  optional: string;
  topic: string;
  topics: Record<InquiryTopic, string>;
  /** "{plan}" becomes the plan's name. */
  aboutPlan: string;
  message: string;
  send: string;
  sending: string;
  thanksTitle: string;
  thanksBody: string;
  sendAnother: string;
  errors: {
    name: string;
    contact: string;
    messageShort: string;
    messageLong: string;
    tooMany: string;
    failed: string;
  };
  retry: string;
}

export const contact: Record<Locale, ContactCopy> = {
  he: {
    title: "בואו נדבר",
    lead: "ספרו לנו על העסק שלכם, או שאלו כל דבר. אדם אמיתי קורא כל הודעה וחוזר אליכם.",
    instagramLine: "מעדיפים לכתוב לנו באינסטגרם? גם שם אנחנו עונים.",
    form: {
      name: "השם שלכם",
      contact: "טלפון או אימייל",
      contactHint: "כדי שנוכל לחזור אליכם.",
      business: "שם העסק",
      optional: "לא חובה",
      topic: "במה מדובר?",
      topics: {
        general: "שאלה",
        join: "להוסיף את העסק שלי לדרב",
        plan: "תוכנית",
        other: "משהו אחר",
      },
      aboutPlan: "לגבי התוכנית: {plan}",
      message: "ההודעה שלכם",
      send: "שליחה",
      sending: "שולחים...",
      thanksTitle: "תודה, קיבלנו.",
      thanksBody: "נחזור אליכם בקרוב.",
      sendAnother: "לשלוח הודעה נוספת",
      errors: {
        name: "כתבו את השם שלכם, לפחות 2 אותיות.",
        contact: "כתבו מספר טלפון או כתובת אימייל.",
        messageShort: "כתבו עוד קצת, לפחות 10 תווים.",
        messageLong: "ההודעה ארוכה מדי. קצרו אותה קצת.",
        tooMany: "שלחתם כבר כמה הודעות. נסו שוב בעוד כמה דקות.",
        failed: "לא הצלחנו לשלוח את ההודעה. ההודעה שלכם עדיין כאן, נסו שוב.",
      },
      retry: "לנסות שוב",
    },
  },
  ar: {
    title: "يلا نحكي",
    lead: "إحكيلنا عن مصلحتك، أو اسألنا عن أي إشي. في إنسان حقيقي بقرا كل رسالة وبرجعلك.",
    instagramLine: "بتحب تحكي معنا على إنستغرام؟ منرد هناك كمان.",
    form: {
      name: "اسمك",
      contact: "تلفون أو إيميل",
      contactHint: "عشان نقدر نرجعلك.",
      business: "اسم المصلحة",
      optional: "مش ضروري",
      topic: "عن شو الموضوع؟",
      topics: {
        general: "سؤال",
        join: "بدي أضيف مصلحتي لدرب",
        plan: "خطة",
        other: "إشي تاني",
      },
      aboutPlan: "بخصوص الخطة: {plan}",
      message: "رسالتك",
      send: "ابعث",
      sending: "عم نبعث...",
      thanksTitle: "شكرًا، وصلتنا.",
      thanksBody: "رح نرجعلك قريب.",
      sendAnother: "ابعث رسالة تانية",
      errors: {
        name: "اكتب اسمك، حرفين على الأقل.",
        contact: "اكتب رقم تلفون أو إيميل.",
        messageShort: "اكتب كمان شوي، 10 أحرف على الأقل.",
        messageLong: "الرسالة طويلة كثير. قصّرها شوي.",
        tooMany: "بعثت كم رسالة. جرّب كمان كم دقيقة.",
        failed: "ما قدرنا نبعث رسالتك. رسالتك لسا هون، جرّب كمان مرة.",
      },
      retry: "جرّب كمان مرة",
    },
  },
  en: {
    title: "Let's talk",
    lead: "Tell us about your business, or ask us anything. A real person reads every message and gets back to you.",
    instagramLine: "Rather write to us on Instagram? We answer there too.",
    form: {
      name: "Your name",
      contact: "Phone or email",
      contactHint: "So we can get back to you.",
      business: "Business name",
      optional: "optional",
      topic: "What is it about?",
      topics: {
        general: "A question",
        join: "Adding my business to Darb",
        plan: "A plan",
        other: "Something else",
      },
      aboutPlan: "About the plan: {plan}",
      message: "Your message",
      send: "Send",
      sending: "Sending...",
      thanksTitle: "Thanks, we got it.",
      thanksBody: "We'll get back to you soon.",
      sendAnother: "Send another message",
      errors: {
        name: "Please write your name, at least 2 letters.",
        contact: "Please write a phone number or an email address.",
        messageShort: "Please write a little more, at least 10 characters.",
        messageLong: "That message is too long. Please shorten it a little.",
        tooMany: "You've sent a few messages already. Please try again in a few minutes.",
        failed: "We couldn't send your message. It's still here, please try again.",
      },
      retry: "Try again",
    },
  },
};
