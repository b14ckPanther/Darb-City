import { notFound } from "next/navigation";
import {
  looksLikeEmail,
  type AdminInquiryDto,
  type AdminInquiryPageDto,
  type InquiryTopic,
} from "@darb/contracts";
import type { Locale } from "@darb/core";
import { ActionButton } from "@/admin/ActionButton";
import { adminApi, okOr } from "@/admin/api";
import { at, type AdminKey } from "@/admin/copy";
import { setInquiryStatus } from "@/admin/inquiry-actions";
import { one, withParams, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { Pager } from "@/admin/Toolbar";
import { INTL_TAG, isLocale } from "@/lib/locale";
import { Empty, PageHead, Status, StatusTabs } from "@/admin/ui";
import styles from "@/admin/admin.module.css";

const LOCALE_NAMES: Record<Locale, string> = { he: "עברית", ar: "العربية", en: "English" };

const TOPIC: Record<InquiryTopic, AdminKey> = {
  general: "topicGeneral",
  join: "topicJoin",
  plan: "topicPlan",
  other: "topicOther",
};

/** tel: keeps only what a dialler reads: digits and a leading +. */
const contactHref = (contact: string) =>
  looksLikeEmail(contact) ? `mailto:${contact}` : `tel:${contact.replace(/[^\d+]/g, "")}`;

function Inquiry({ locale, item }: { locale: Locale; item: AdminInquiryDto }) {
  const fresh = item.status === "new";
  const received = new Intl.DateTimeFormat(INTL_TAG[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(item.createdAt));
  return (
    <article
      className={fresh ? `${styles.card} ${styles.inquiry} ${styles.inquiryNew}` : styles.card}
      aria-labelledby={`inquiry-${item.id}`}
    >
      <header className={styles.inquiryHead}>
        <h2 id={`inquiry-${item.id}`} className={styles.h2}>
          <bdi>{item.name}</bdi>
        </h2>
        <Status locale={locale} status={item.status} />
        <time dateTime={item.createdAt} className={styles.hint}>
          {at(locale, "inquiryReceived")}: {received}
        </time>
      </header>
      <dl className={styles.facts}>
        <dt>{at(locale, "inquiryContact")}</dt>
        <dd>
          <a href={contactHref(item.contact)} dir="ltr">
            {item.contact}
          </a>
        </dd>
        {item.businessName ? (
          <>
            <dt>{at(locale, "inquiryBusiness")}</dt>
            <dd>
              <bdi>{item.businessName}</bdi>
            </dd>
          </>
        ) : null}
        <dt>{at(locale, "inquiryTopic")}</dt>
        <dd>{at(locale, TOPIC[item.topic])}</dd>
        {item.plan ? (
          <>
            <dt>{at(locale, "inquiryPlan")}</dt>
            <dd dir="ltr">{item.plan}</dd>
          </>
        ) : null}
        <dt>{at(locale, "inquiryLocale")}</dt>
        <dd>{LOCALE_NAMES[item.locale]}</dd>
      </dl>
      <p className={styles.message} dir="auto">
        {item.message}
      </p>
      <p className={styles.hint}>
        {at(locale, item.emailedAt ? "inquiryMailed" : "inquiryNotMailed")}
      </p>
      <ActionButton
        action={setInquiryStatus}
        fields={{ id: item.id, status: fresh ? "handled" : "new", locale }}
        label={at(locale, fresh ? "markHandled" : "reopen")}
        className={fresh ? styles.primary : styles.ghost}
      />
    </article>
  );
}

/** The contact form's inbox: newest first, new ones marked, every field shown. */
export default async function InquiriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const raw = one(sp.status);
  const status = raw === "new" || raw === "handled" ? raw : undefined;
  const page = okOr<AdminInquiryPageDto>(
    await (await adminApi()).inquiries.list({ query: { status, cursor: one(sp.cursor) } }),
    locale,
  );
  const base = adminHref(locale, "/inquiries");
  const filters: [string | undefined, AdminKey][] = [
    [undefined, "all"],
    ["new", "inquiryNew"],
    ["handled", "inquiryHandled"],
  ];
  return (
    <div className={styles.narrow}>
      <PageHead title={at(locale, "navInquiries")} sub={at(locale, "inquiriesHint")} />
      <StatusTabs
        label={at(locale, "status")}
        tabs={filters.map(([value, key]) => ({
          href: withParams(base, { status: value }),
          label: at(locale, key),
          current: status === value,
          count: value === "new" ? page.newCount : undefined,
        }))}
      />
      {page.items.length === 0 ? (
        <div className={styles.tableWrap}>
          <Empty icon="mail" title={at(locale, "inquiriesEmpty")} />
        </div>
      ) : (
        page.items.map((item) => <Inquiry key={item.id} locale={locale} item={item} />)
      )}
      <Pager
        locale={locale}
        href={page.nextCursor ? withParams(base, { status, cursor: page.nextCursor }) : null}
      />
    </div>
  );
}
