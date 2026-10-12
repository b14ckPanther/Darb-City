import { redirect } from "next/navigation";
import { placeKindShortcut } from "@/lib/levels";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

/** Search lands here without knowing the sector; the canonical URL has it. */
export default async function PlaceKindShortcut({
  params,
}: {
  params: Promise<{ locale: string; place: string; kind: string }>;
}) {
  redirect(await placeKindShortcut(await params));
}
