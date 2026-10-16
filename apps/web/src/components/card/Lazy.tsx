"use client";

import dynamic from "next/dynamic";

/**
 * The card's two islands, each its own chunk, fetched after the page: both are server-rendered
 * all the same (the dial and words, the thumbnails), so nothing moves when they arrive. Most cards
 * have no photos, and the strip's code is never fetched for those.
 */
export const TodayState = dynamic(() => import("./TodayState").then((m) => m.TodayState));
export const PhotoStrip = dynamic(() => import("./PhotoStrip").then((m) => m.PhotoStrip));
