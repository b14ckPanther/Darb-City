import { notFound } from "next/navigation";
import { PRICING_TEXT_KEYS, type AdminTextDto } from "@darb/contracts";
import { savePageTexts } from "@/admin/actions";
import { ActionForm } from "@/admin/ActionForm";
import { adminApi, okOr } from "@/admin/api";
import { adminHref } from "@/admin/routes";
import { Owner, PageHead, StatusTabs } from "@/admin/ui";
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
    <div className={styles.narrow}>
      <PageHead
        title={at(locale, "pageTexts")}
        sub={at(locale, "pageTextsHint")}
        back={{ href: adminHref(locale, "/plans"), label: at(locale, "navPlans") }}
      />
      <StatusTabs
        label={at(locale, "navPlans")}
        tabs={[
          { href: adminHref(locale, "/plans"), label: at(locale, "plansTab"), current: false },
          {
            href: adminHref(locale, "/plans/texts"),
            label: at(locale, "pageTexts"),
            current: true,
          },
        ]}
      />
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
            <fieldset key={t.id} className={`${styles.fieldset} ${styles.textGroup}`}>
              <legend>
                {textLabel(locale, t.key)} <Owner locale={locale} editedAt={t.editedAt} />
              </legend>
              {langs.map(([l, key, dir]) => (
                <TextArea
                  key={l}
                  label={at(locale, key)}
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
    </div>
  );
}
