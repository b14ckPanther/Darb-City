import { notFound } from "next/navigation";
import type { HelperMeDto } from "@darb/contracts";
import { pickText, type Locale, type Localized } from "@darb/core";
import { StreetCapture, type QuickAdd, type StreetKind } from "@/admin/street/StreetCapture";
import { ApplyForm, type TownOption } from "@/helpers/ApplyForm";
import { canAdd, helperApi, helperOrSignIn } from "@/helpers/api";
import { locateForHelper } from "@/helpers/actions";
import { ht } from "@/helpers/copy";
import { HelperShell, HelperSignOut } from "@/helpers/HelperShell";
import { incomingFrom } from "@/helpers/incoming";
import { InstallCard } from "@/helpers/InstallCard";
import { Moments } from "@/helpers/Moments";
import { momentsView, type MomentsView } from "@/helpers/moment-view";
import { helperHref } from "@/helpers/routes";
import { getPlaces, getTaxonomy } from "@/lib/api";
import { foldText } from "@/lib/fold-text";
import { INTL_TAG, isLocale } from "@/lib/locale";
import styles from "@/helpers/helpers.module.css";

/** Every name a thing has, folded, so a town is found by any spelling. */
const searchText = (name: Localized, extra: string[] = []) =>
  foldText([...Object.values(name), ...extra].filter(Boolean).join(" | "));

/** The note's glyph: an hourglass (waiting), a pause, or a cloud (cannot reach Darb). */
const NOTE_ICON = {
  wait: "M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9",
  pause: "M9 6v12M15 6v12",
  away: "M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9H7Z",
} as const;

/** A screen with only words: sign-in is off, the API is down, waiting, paused. */
function Note({
  locale,
  title,
  lead,
  icon = "away",
  tabs = false,
  signOut = false,
  again = false,
}: {
  locale: Locale;
  title: string;
  lead: string;
  icon?: keyof typeof NOTE_ICON;
  tabs?: boolean;
  signOut?: boolean;
  /** "Check again": reloads this screen (it opens on adding once approved). */
  again?: boolean;
}) {
  return (
    <HelperShell locale={locale} tab="add" tabs={tabs}>
      <section className={styles.state} aria-labelledby="helper-state">
        <span className={styles.stateIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30">
            <path
              d={NOTE_ICON[icon]}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 id="helper-state" className={styles.title}>
          {title}
        </h1>
        <p className={styles.muted}>{lead}</p>
        {again ? (
          <a href={helperHref(locale)} className={`${styles.primary} ${styles.wide}`}>
            {ht(locale, "waitingCheck")}
          </a>
        ) : null}
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
async function captureScreen(locale: Locale, me: HelperMeDto, incoming: QuickAdd["incoming"]) {
  const api = await helperApi();
  const [taxonomy, status, mine, moments] = await Promise.all([
    getTaxonomy(),
    api.field.status(),
    api.field.mine(),
    // A milestone and what went live: helpers only (admins approve their own). Never blocks adding.
    me.isAdmin
      ? null
      : Promise.resolve()
          .then(() => api.moments())
          .then((r): MomentsView | null => (r.status === 200 ? momentsView(locale, r.body) : null))
          .catch(() => null),
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
      <h1 className={styles.screenTitle}>{ht(locale, "addTitle")}</h1>
      {moments ? (
        <Moments
          view={moments}
          seeHref={helperHref(locale, "/mine")}
          copy={{
            label: ht(locale, "milestoneLabel"),
            go: ht(locale, "milestoneGo"),
            see: ht(locale, "wentLiveSee"),
            close: ht(locale, "wentLiveClose"),
          }}
        />
      ) : null}
      <StreetCapture
        locale={locale}
        kinds={kinds}
        reading={status.body.reading}
        uploads={status.body.uploads}
        base={helperHref(locale, "/field-api")}
        locate={locateForHelper}
        matchLinks="none"
        distinct
        quick={{
          today: mine.body.today,
          // Their own cap; with none (admins, or lifted by an admin) the bar shows only the count.
          limit: me.dailyLimit,
          incoming,
          aside: (
            <InstallCard
              key="install"
              copy={{
                title: ht(locale, "installTitle"),
                lead: ht(locale, "installLead"),
                button: ht(locale, "installButton"),
                ios: ht(locale, "installIos"),
                iosShare: ht(locale, "installIosShare"),
                iosAdd: ht(locale, "installIosAdd"),
                dismiss: ht(locale, "installDismiss"),
              }}
            />
          ),
        }}
      />
    </HelperShell>
  );
}

/**
 * The helper app's home, by where the person stands: signed out goes to sign in; then the apply
 * form, the waiting screen, the paused screen, or (approved helpers and admins) the capture.
 */
export default async function HelperHome({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await helperOrSignIn(locale);
  if (session.status === "off")
    return <Note locale={locale} title={ht(locale, "title")} lead={ht(locale, "notConfigured")} />;
  if (session.status === "unavailable")
    return <Note locale={locale} title={ht(locale, "title")} lead={ht(locale, "offline")} />;
  const me = session.me;
  if (canAdd(me)) return captureScreen(locale, me, incomingFrom((await searchParams) ?? {}));
  if (me.status === "pending")
    return (
      <Note
        locale={locale}
        title={ht(locale, "waitingTitle")}
        lead={ht(locale, "waitingLead")}
        icon="wait"
        again
        signOut
      />
    );
  if (me.status === "paused")
    return (
      <Note
        locale={locale}
        title={ht(locale, "pausedTitle")}
        lead={ht(locale, "pausedLead")}
        icon="pause"
        tabs
      />
    );
  return applyScreen(locale, me);
}
