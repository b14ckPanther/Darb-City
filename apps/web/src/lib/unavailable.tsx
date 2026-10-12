import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import type { ReactNode } from "react";
import { t } from "@darb/i18n";
import { ErrorView } from "@/components/ErrorView";
import { ApiUnavailableError } from "./api";
import { isLocale } from "./locale";

/**
 * Next 16 fails an ISR render (plain-text 500) on any thrown error, even one an error boundary
 * catches. So a level that cannot reach the API renders the retry view itself, and marks the render
 * with this tag: the cache handler (`cache-handler.mjs`) never stores a tagged page, so the retry
 * view is not served from the cache and a stale good copy is kept.
 */
export const UNAVAILABLE_TAG = "darb:api-unavailable";

async function markUnavailable(): Promise<void> {
  // The tag and a 1 s lifetime reach the page through the render's collected tags and revalidate,
  // so even a CDN in front only holds the retry view for a second.
  await unstable_cache(async () => true, [UNAVAILABLE_TAG], {
    revalidate: 1,
    tags: [UNAVAILABLE_TAG],
  })();
}

/** Wraps a level page or layout: the API being down renders the retry view instead of failing. */
export function orUnavailable<P>(render: (props: P) => Promise<ReactNode>) {
  return async function Level(props: P): Promise<ReactNode> {
    try {
      return await render(props);
    } catch (error) {
      if (!(error instanceof ApiUnavailableError)) throw error;
      await markUnavailable();
      return <ErrorView />;
    }
  };
}

/** Wraps `generateMetadata` the same way, giving the retry view a plain title. */
export function metadataOrUnavailable<P extends { params: Promise<{ locale: string }> }>(
  generate: (props: P) => Promise<Metadata>,
) {
  return async function metadata(props: P): Promise<Metadata> {
    try {
      return await generate(props);
    } catch (error) {
      if (!(error instanceof ApiUnavailableError)) throw error;
      await markUnavailable();
      const { locale } = await props.params;
      return {
        title: t(isLocale(locale) ? locale : "he", "unreachable"),
        robots: { index: false },
      };
    }
  };
}
