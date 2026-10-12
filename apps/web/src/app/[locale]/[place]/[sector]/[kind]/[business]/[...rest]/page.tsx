import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BusinessLevelView, businessLevelMetadata } from "@/components/BusinessLevelView";
import { loadBusinessLevel } from "@/lib/levels";
import { metadataOrUnavailable, orUnavailable } from "@/lib/unavailable";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Params = {
  locale: string;
  place: string;
  sector: string;
  kind: string;
  business: string;
  rest: string[];
};
type Props = { params: Promise<Params> };

/**
 * `/{place}/{sector}/{kind}/{own}/{business}`: a business from a place beneath the listed one,
 * opened from the listed place's list (here `business` is the own place). Deeper is not found.
 */
async function load(params: Props["params"]) {
  const { rest, business: own, ...raw } = await params;
  const [business, ...deeper] = rest;
  if (!business || deeper.length > 0) notFound();
  return loadBusinessLevel(raw, { place: own, business });
}

export const generateMetadata = metadataOrUnavailable(
  async ({ params }: Props): Promise<Metadata> => businessLevelMetadata(await load(params)),
);

export default orUnavailable(async function SubPlaceBusinessPage({ params }: Props) {
  return <BusinessLevelView level={await load(params)} />;
});
