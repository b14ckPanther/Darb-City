"use client";

import { ErrorView } from "@/components/ErrorView";

export default function CityError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorView retry={retry} />;
}
