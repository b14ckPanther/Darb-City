import type { Metadata } from "next";
import { tokensCss } from "@/lib/tokens-css";
import "./globals.css";

export const metadata: Metadata = { title: "404 · Darb", robots: { index: false } };

/** Unmatched URLs outside the root layout (e.g. /api/nope). Bilingual, links home. */
export default function GlobalNotFound() {
  return (
    <html lang="he" dir="rtl">
      <head>
        <style dangerouslySetInnerHTML={{ __html: tokensCss() }} />
      </head>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100dvh",
          margin: 0,
        }}
      >
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>
            הדף לא נמצא · <span lang="ar">الصفحة غير موجودة</span>
          </h1>
          <p lang="en" dir="ltr">
            This page does not exist.
          </p>
          <p>
            {/* A full document load on purpose: this page sits outside the [locale] root layout. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="text-link">
              דרב · <span lang="ar">درب</span> · <span lang="en">Darb</span>
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
