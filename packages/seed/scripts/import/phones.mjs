// Israeli phone numbers as the listings (data/listings/) write them: "+972 4-636-0576", "+972 54-533-0829".
// Anything that is not a valid Israeli landline, mobile or national number gives null.

/** Landline area codes and mobile prefixes, without the leading 0. */
const LANDLINE = /^(2|3|4|8|9)\d{7}$/;
const MOBILE = /^5\d{8}$/;
const VOIP = /^7\d{8}$/;

/**
 * Normalises one number. Accepts "04-6930906", "046930906", "+972-4-6930906", "972 54 533 0829".
 * Several numbers in one field ("04-1234567, 052-...") give the first valid one.
 */
export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  for (const piece of String(raw).split(/[,;/|]|\s{2,}/)) {
    const phone = one(piece);
    if (phone) return phone;
  }
  return null;
}

function one(raw) {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("972")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (/^(.)\1+$/.test(digits)) return null;
  if (LANDLINE.test(digits)) return `+972 ${digits[0]}-${digits.slice(1, 4)}-${digits.slice(4)}`;
  if (MOBILE.test(digits) || VOIP.test(digits))
    return `+972 ${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  return null;
}
