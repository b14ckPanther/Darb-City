/**
 * A form's values as one string, so "changed since it loaded" is a comparison. Files are left out
 * (uploads land in hidden inputs as keys), and order follows the form.
 */
export function snapshot(form: HTMLFormElement): string {
  const out: [string, string][] = [];
  for (const [k, v] of new FormData(form)) if (typeof v === "string") out.push([k, v]);
  return JSON.stringify(out);
}

/** The values a live preview reads, by name; the last of a repeated name wins. */
export function formValues(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new FormData(form)) if (typeof v === "string") out[k] = v;
  return out;
}
