import type { Locale } from "@darb/core";

/**
 * The words of Darb's own sign-in and sign-up (admin and helpers). No dashes, no language names;
 * Arabic is spoken Levantine.
 */
const en = {
  emailLabel: "What is your email?",
  emailHint: "We will send you a short code.",
  passwordLabel: "Your password",
  newPasswordLabel: "Choose a password",
  newPasswordHint: "At least 8 characters.",
  showPassword: "Show password",
  hidePassword: "Hide password",
  continue: "Continue",
  signIn: "Sign in",
  working: "One moment…",
  codeLabel: "The code from the email",
  codeSent: "We sent a 6 digit code to",
  codeApp: "Enter the 6 digit code from your authenticator app.",
  codePhone: "We sent a 6 digit code to your phone.",
  codeHint: "Not there? Check the spam folder.",
  changeEmail: "Change email",
  resend: "Send a new code",
  resendIn: "New code in {s}",
  resent: "A new code is on its way.",
  usePassword: "Use my password instead",
  useCode: "Email me a code instead",
  done: "You are in. Welcome!",
  noAccount: "New here?",
  toSignUp: "Create an account",
  haveAccount: "Already have an account?",
  toSignIn: "Sign in",
  errNotFound: "There is no account with this email yet.",
  errNotFoundAdmin: "There is no account with this email.",
  errExists: "This email already has an account.",
  errWrongCode: "That code is not right. Check the email and try again.",
  errExpired: "This code has expired. Send a new one.",
  errTooMany: "Too many tries. Wait a minute and try again.",
  errWrongPassword: "That password is not right.",
  errWeakPassword: "Pick a longer password that is harder to guess.",
  errPwned: "This password showed up in a known leak. Pick another one.",
  errBadEmail: "Write a full email address, like name@example.com.",
  errUnsupported: "This account needs a step we cannot do here. Ask Darb's team for help.",
  errGeneric: "Something went wrong. Try again.",
};

export type AuthKey = keyof typeof en;
type Messages = Record<AuthKey, string>;

const he: Messages = {
  emailLabel: "מה האימייל שלכם?",
  emailHint: "נשלח לכם קוד קצר.",
  passwordLabel: "הסיסמה שלכם",
  newPasswordLabel: "בחרו סיסמה",
  newPasswordHint: "לפחות 8 תווים.",
  showPassword: "הצגת הסיסמה",
  hidePassword: "הסתרת הסיסמה",
  continue: "המשך",
  signIn: "כניסה",
  working: "רגע אחד…",
  codeLabel: "הקוד מהאימייל",
  codeSent: "שלחנו קוד בן 6 ספרות אל",
  codeApp: "הקלידו את הקוד בן 6 הספרות מאפליקציית האימות.",
  codePhone: "שלחנו קוד בן 6 ספרות לטלפון שלכם.",
  codeHint: "לא הגיע? בדקו בתיקיית הספאם.",
  changeEmail: "שינוי האימייל",
  resend: "שליחת קוד חדש",
  resendIn: "קוד חדש בעוד {s}",
  resent: "קוד חדש בדרך אליכם.",
  usePassword: "כניסה עם סיסמה",
  useCode: "שלחו לי קוד באימייל",
  done: "נכנסתם. ברוכים הבאים!",
  noAccount: "חדשים כאן?",
  toSignUp: "יצירת חשבון",
  haveAccount: "כבר יש לכם חשבון?",
  toSignIn: "כניסה",
  errNotFound: "עדיין אין חשבון עם האימייל הזה.",
  errNotFoundAdmin: "אין חשבון עם האימייל הזה.",
  errExists: "לאימייל הזה כבר יש חשבון.",
  errWrongCode: "הקוד לא נכון. בדקו את האימייל ונסו שוב.",
  errExpired: "תוקף הקוד פג. שלחו קוד חדש.",
  errTooMany: "יותר מדי ניסיונות. חכו דקה ונסו שוב.",
  errWrongPassword: "הסיסמה לא נכונה.",
  errWeakPassword: "בחרו סיסמה ארוכה יותר שקשה לנחש.",
  errPwned: "הסיסמה הזאת הופיעה בדליפה ידועה. בחרו סיסמה אחרת.",
  errBadEmail: "כתבו כתובת אימייל מלאה, למשל name@example.com.",
  errUnsupported: "החשבון הזה צריך שלב שאי אפשר לעשות כאן. פנו לצוות של דרב.",
  errGeneric: "משהו השתבש. נסו שוב.",
};

const ar: Messages = {
  emailLabel: "شو إيميلك؟",
  emailHint: "رح نبعتلك كود قصير.",
  passwordLabel: "كلمة السر تبعك",
  newPasswordLabel: "اختار كلمة سر",
  newPasswordHint: "8 حروف عالأقل.",
  showPassword: "فرجيني كلمة السر",
  hidePassword: "خبّي كلمة السر",
  continue: "كمّل",
  signIn: "فوت",
  working: "لحظة…",
  codeLabel: "الكود اللي بالإيميل",
  codeSent: "بعتنالك كود من 6 أرقام على",
  codeApp: "اكتب الكود من 6 أرقام من تطبيق التحقق.",
  codePhone: "بعتنالك كود من 6 أرقام على تلفونك.",
  codeHint: "ما وصل؟ اتطلع بمجلد السبام.",
  changeEmail: "غيّر الإيميل",
  resend: "ابعتلي كود جديد",
  resendIn: "كود جديد بعد {s}",
  resent: "الكود الجديد بالطريق.",
  usePassword: "بدي فوت بكلمة السر",
  useCode: "ابعتولي كود عالإيميل",
  done: "فتت. أهلا وسهلا!",
  noAccount: "جديد هون؟",
  toSignUp: "اعمل حساب",
  haveAccount: "عندك حساب؟",
  toSignIn: "فوت",
  errNotFound: "لسّا ما في حساب بهالإيميل.",
  errNotFoundAdmin: "ما في حساب بهالإيميل.",
  errExists: "هالإيميل إله حساب من قبل.",
  errWrongCode: "الكود مش صح. اتطلع بالإيميل وجرّب كمان مرة.",
  errExpired: "الكود خلص وقته. ابعت واحد جديد.",
  errTooMany: "جرّبت كتير. استنى دقيقة وجرّب كمان مرة.",
  errWrongPassword: "كلمة السر مش صح.",
  errWeakPassword: "اختار كلمة سر أطول وأصعب تنحزر.",
  errPwned: "كلمة السر هاي طلعت بتسريب معروف. اختار غيرها.",
  errBadEmail: "اكتب إيميل كامل، متل name@example.com.",
  errUnsupported: "هالحساب بدّه خطوة ما منقدر نعملها هون. احكي مع فريق درب.",
  errGeneric: "صار في غلط. جرّب كمان مرة.",
};

export const authCopy: Record<Locale, Messages> = { he, ar, en };

/** The flow's words for one locale, with `{s}` and `{n}` left for the flow to fill. */
export function authMessages(locale: Locale): Messages {
  return authCopy[locale];
}

export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : m,
  );
}
