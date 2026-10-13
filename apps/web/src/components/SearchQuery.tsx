"use client";

import { useEffect } from "react";
import { publishQuery } from "@/search/query";

/** Puts the searched text back into the header box on /search. Renders nothing. */
export function SearchQuery({ q }: { q: string }) {
  useEffect(() => publishQuery(q), [q]);
  return null;
}
