export const notFound = (what: string) => ({
  status: 404 as const,
  body: { message: `No ${what}` },
});
export const conflict = (message: string) => ({ status: 409 as const, body: { message } });
export const invalid = (message: string, errors?: string[]) => ({
  status: 400 as const,
  body: errors ? { message, errors } : { message },
});
