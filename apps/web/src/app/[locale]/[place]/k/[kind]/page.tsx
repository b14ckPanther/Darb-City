import { redirect } from "next/navigation";
import { placeKindShortcut } from "@/lib/levels";
import { orUnavailable } from "@/lib/unavailable";

export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}

/** Search lands here without knowing the sector; the canonical URL has it. */
export default orUnavailable(async function PlaceKindShortcut({
  params,
}: {
  params: Promise<{ locale: string; place: string; kind: string }>;
}) {
  redirect(await placeKindShortcut(await params));
});
