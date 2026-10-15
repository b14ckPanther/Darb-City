"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Writes the section's scroll progress to `--p` (0 when its top meets the viewport's top, 1 when
 * its bottom does) for CSS to animate with transforms only. It listens only while the section is
 * on screen, at most once a frame; with reduced motion `--p` stays at 1 (the finished scene).
 */
export function ScrollScene({
  className,
  children,
  as: Tag = "section",
  labelledBy,
  stop,
}: {
  className?: string;
  children: ReactNode;
  as?: "section" | "div";
  labelledBy?: string;
  /** A station on the landing road (Road lights it up when the road arrives). */
  stop?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--p", "1");
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      const room = box.height - window.innerHeight;
      const p = room > 0 ? -box.top / room : box.top <= 0 ? 1 : 0;
      el.style.setProperty("--p", Math.min(1, Math.max(0, p)).toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const watch = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
      } else {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      }
    });
    watch.observe(el);
    return () => {
      watch.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={className}
      aria-labelledby={labelledBy}
      data-stop={stop ? "" : undefined}
    >
      {children}
    </Tag>
  );
}

/** Marks children `data-shown` once they scroll into view, for one-time CSS entrances. */
export function Reveal({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: ReactNode;
  as?: "div" | "li" | "p" | "figure";
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.setAttribute("data-shown", "");
        watch.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} className={className} data-reveal="">
      {children}
    </Tag>
  );
}
