import type { Metadata } from "next";
import { BusinessLevelView, businessLevelMetadata } from "@/components/BusinessLevelView";
import { loadBusinessLevel } from "@/lib/levels";
import { metadataOrUnavailable, orUnavailable } from "@/lib/unavailable";

export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}

type Params = { locale: string; place: string; sector: string; kind: string; business: string };
type Props = { params: Promise<Params> };

/** The business lives in this place or beneath it (the API 404s otherwise) and is of this kind. */
async function load(params: Props["params"]) {
  const raw = await params;
  return loadBusinessLevel(raw, { business: raw.business });
}

export const generateMetadata = metadataOrUnavailable(
  async ({ params }: Props): Promise<Metadata> => businessLevelMetadata(await load(params)),
);

export default orUnavailable(async function BusinessPage({ params }: Props) {
  return <BusinessLevelView level={await load(params)} />;
});
