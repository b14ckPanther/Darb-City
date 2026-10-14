export const notFound = (what: string) => ({
  status: 404 as const,
  body: { message: `No ${what}` },
});
/** `code` is a stable, machine-readable reason the admin UI can branch on. */
export const conflict = (message: string, code?: string) => ({
  status: 409 as const,
  body: code ? { message, code } : { message },
});
export const invalid = (message: string, errors?: string[], code?: string) => ({
  status: 400 as const,
  body: { message, ...(errors ? { errors } : {}), ...(code ? { code } : {}) },
});
/** A takedown's web revalidation outcome, only when there is one to report. */
export const outcome = (revalidated: boolean | undefined) =>
  revalidated === undefined ? {} : { revalidated };
