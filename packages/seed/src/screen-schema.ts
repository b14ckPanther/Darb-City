const localized = {
  type: "object",
  properties: { he: { type: "string" }, ar: { type: "string" }, en: { type: "string" } },
  additionalProperties: false,
  minProperties: 1,
} as const;

/**
 * Experience content of a v1 showroom business. In v1 every template shares this shape (it is
 * the shape of the Universe screens); template-specific schemas arrive with the owner studio.
 */
export const SCREEN_SCHEMA = {
  type: "object",
  required: ["brand", "title", "items", "cta", "palette", "font"],
  properties: {
    brand: localized,
    title: localized,
    subtitle: localized,
    tags: { type: "array", items: localized },
    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["label"],
        properties: { label: localized, meta: localized },
        additionalProperties: false,
      },
    },
    cta: localized,
    palette: {
      type: "object",
      required: ["bg", "surface", "ink", "accent"],
      properties: Object.fromEntries(
        ["bg", "surface", "ink", "accent"].map((k) => [
          k,
          { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
        ]),
      ),
      additionalProperties: false,
    },
    font: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const;
