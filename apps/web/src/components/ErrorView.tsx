"use client";

import { useParams } from "next/navigation";
import { t } from "@darb/i18n";
import { isLocale } from "@/lib/locale";

/**
 * API unreachable: a quiet notice and a retry, inside the city frame. From `error.tsx` it retries
 * the render; rendered by a level itself (see lib/unavailable) it reloads the page.
 */
export function ErrorView({ retry }: { retry?: () => void }) {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale && isLocale(params.locale) ? params.locale : "he";
  return (
    <main id="main" className="frame">
      <div className="quiet" role="status" data-unreachable="">
        <p>{t(locale, "unreachable")}</p>
        <button
          type="button"
          className="button"
          onClick={() => (retry ? retry() : window.location.reload())}
        >
          {t(locale, "retry")}
        </button>
      </div>
    </main>
  );
}
