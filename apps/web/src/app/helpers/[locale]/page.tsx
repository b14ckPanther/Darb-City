import { notFound } from "next/navigation";
import { HELPER_DAILY, type HelperMeDto } from "@darb/contracts";
import { pickText, type Locale, type Localized } from "@darb/core";
import { StreetCapture, type StreetKind } from "@/admin/street/StreetCapture";
import { ApplyForm, type TownOption } from "@/helpers/ApplyForm";
import { canAdd, helperApi, helperOrSignIn } from "@/helpers/api";
import { locateForHelper } from "@/helpers/actions";
import { ht } from "@/helpers/copy";
import { HelperShell, HelperSignOut } from "@/helpers/HelperShell";
import { InstallCard } from "@/helpers/InstallCard";
import { helperHref } from "@/helpers/routes";
import { getPlaces, getTaxonomy } from "@/lib/api";
import { foldText } from "@/lib/fold-text";
import { INTL_TAG, isLocale } from "@/lib/locale";
import styles from "@/helpers/helpers.module.css";

/** Every name a thing has, folded, so a town is found by any spelling. */
const searchText = (name: Localized, extra: string[] = []) =>
  foldText([...Object.values(name), ...extra].filter(Boolean).join(" | "));

/** A screen with only words: sign-in is off, the API is down, waiting, paused. */
function Note({
  locale,
  title,
  lead,
  tabs = false,
  signOut = false,
}: {
  locale: Locale;
  title: string;
  lead: string;
  tabs?: boolean;
  signOut?: boolean;
}) {
  return (
    <HelperShell locale={locale} tab="add" tabs={tabs}>
      <section className={styles.state} aria-labelledby="helper-state">
        <h1 id="helper-state" className={styles.title}>
          {title}
        </h1>
        <p className={styles.muted}>{lead}</p>
        {signOut ? (
          <div className={styles.row}>
            <HelperSignOut locale={locale} className={styles.ghost} />
          </div>
        ) : null}
      </section>
    </HelperShell>
  );
}

/** The apply form, with every town to pick from. */
async function applyScreen(locale: Locale, me: HelperMeDto) {
  const places = await getPlaces();
  const towns: TownOption[] = places
    .filter((p) => p.type === "city" || p.type === "town" || p.type === "village")
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      label: pickText(p.name, locale),
      search: searchText(p.name, [p.slug.replace(/-/g, " ")]),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  return (
    <HelperShell locale={locale}>
      <h1 className={styles.title}>{ht(locale, "applyTitle")}</h1>
      <p className={styles.lead}>{ht(locale, "applyLead")}</p>
      <ApplyForm locale={locale} towns={towns} name={me.name ?? ""} />
      <div className={styles.row}>
        <HelperSignOut locale={locale} className={styles.ghost} />
      </div>
    </HelperShell>
  );
}

/** The capture, for approved helpers and admins, with today's count against the day's cap. */
async function captureScreen(locale: Locale) {
  const api = await helperApi();
  const [taxonomy, status, mine] = await Promise.all([
    getTaxonomy(),
    api.field.status(),
    api.field.mine(),
  ]);
  if (status.status !== 200 || mine.status !== 200)
    return <Note locale={locale} title={ht(locale, "title")} lead={ht(locale, "offline")} tabs />;
  const collator = new Intl.Collator(INTL_TAG[locale]);
  const kinds: StreetKind[] = taxonomy.sectors
    .flatMap((s) =>
      s.kinds.map((k) => ({ slug: k.slug, label: pickText(k.name, locale) || k.slug })),
    )
    .sort((a, b) => collator.compare(a.label, b.label));
  return (
    <HelperShell locale={locale} tab="add" tabs>
      <InstallCard
        copy={{
          title: ht(locale, "installTitle"),
          lead: ht(locale, "installLead"),
          button: ht(locale, "installButton"),
          ios: ht(locale, "installIos"),
          dismiss: ht(locale, "installDismiss"),
        }}
      />
      <h1 className={styles.title}>{ht(locale, "addTitle")}</h1>
      <p className={styles.lead}>
        {ht(locale, "addLead")}{" "}
        <span aria-live="polite">
          {ht(locale, "today", { count: mine.body.today, limit: HELPER_DAILY.captures })}
        </span>
      </p>
      <StreetCapture
        locale={locale}
        kinds={kinds}
        reading={status.body.reading}
        uploads={status.body.uploads}
        base={helperHref(locale, "/field-api")}
        locate={locateForHelper}
        matchLinks="none"
        distinct
      />
    </HelperShell>
  );
}

/**
 * The helper app's home, by where the person stands: signed out goes to sign in; then the apply
 * form, the waiting screen, the paused screen, or (approved helpers and admins) the capture.
 */
export default async function HelperHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await helperOrSignIn(locale);
  if (session.status === "off")
    return <Note locale={locale} title={ht(locale, "title")} lead={ht(locale, "notConfigured")} />;
  if (session.status === "unavailable")
    return <Note locale={locale} title={ht(locale, "title")} lead={ht(locale, "offline")} />;
  const me = session.me;
  if (canAdd(me)) return captureScreen(locale);
  if (me.status === "pending")
    return (
      <Note
        locale={locale}
        title={ht(locale, "waitingTitle")}
        lead={ht(locale, "waitingLead")}
        signOut
      />
    );
  if (me.status === "paused")
    return (
      <Note
        locale={locale}
        title={ht(locale, "pausedTitle")}
        lead={ht(locale, "pausedLead")}
        tabs
      />
    );
  return applyScreen(locale, me);
}
