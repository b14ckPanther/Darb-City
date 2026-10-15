import { notFound } from "next/navigation";
import { PRICING_TEXT_KEYS, type AdminTextDto } from "@darb/contracts";
import { savePageTexts } from "@/admin/actions";
import { ActionForm } from "@/admin/ActionForm";
import { adminApi, okOr } from "@/admin/api";
import { OwnerBadge } from "@/admin/Badges";
import { at, textLabel } from "@/admin/copy";
import { TextArea } from "@/admin/fields";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

/** Long texts (the intro, terms and questions) get room; the rest are a line or two. */
const LONG = new Set<string>(["pricing.intro", "pricing.terms", "pricing.faq"]);
const rank = (key: string) => {
  const i = (PRICING_TEXT_KEYS as readonly string[]).indexOf(key);
  return i === -1 ? PRICING_TEXT_KEYS.length : i;
};

export default async function PageTexts({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const texts = okOr<AdminTextDto[]>(await (await adminApi()).texts.list(), locale)
    .filter((t) => t.key.startsWith("pricing."))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
  const langs = [
    ["he", "langHe", "rtl"],
    ["ar", "langAr", "rtl"],
    ["en", "langEn", "ltr"],
  ] as const;
  return (
    <>
      <h1 className={styles.h1}>{at(locale, "pageTexts")}</h1>
      <p className={styles.hint}>{at(locale, "pageTextsHint")}</p>
      {texts.length === 0 ? (
        <p>{at(locale, "empty")}</p>
      ) : (
        <ActionForm
          action={savePageTexts}
          submit={at(locale, "save")}
          labels={{ fix: at(locale, "errorFix") }}
        >
          <input type="hidden" name="locale" value={locale} />
          {texts.map((t) => (
            <fieldset
              key={t.id}
              className={styles.row}
              style={{ border: 0, padding: 0, margin: 0 }}
            >
              <legend className={styles.h2}>
                {textLabel(locale, t.key)} <OwnerBadge locale={locale} editedAt={t.editedAt} />
              </legend>
              {langs.map(([l, key, dir]) => (
                <TextArea
                  key={l}
                  label={`${textLabel(locale, t.key)} · ${at(locale, key)}`}
                  name={`text.${t.id}.${l}`}
                  defaultValue={t.value[l]}
                  dir={dir}
                  rows={LONG.has(t.key) ? 8 : 2}
                />
              ))}
            </fieldset>
          ))}
        </ActionForm>
      )}
    </>
  );
}
