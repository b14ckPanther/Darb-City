"use client";

import { useEffect, useRef } from "react";
import styles from "./Road.module.css";

type Point = [number, number];

/** A smooth curve through the points: each bend is a cubic with vertical tangents. */
function pathThrough(points: Point[]): string {
  const [first, ...rest] = points;
  if (!first) return "";
  let d = `M${first[0].toFixed(1)} ${first[1].toFixed(1)}`;
  let [px, py] = first;
  for (const [x, y] of rest) {
    const mid = (py + y) / 2;
    d += ` C${px.toFixed(1)} ${mid.toFixed(1)} ${x.toFixed(1)} ${mid.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    [px, py] = [x, y];
  }
  return d;
}

/**
 * Darb means path: one gold road runs from the mark's arch through every section ([data-stop]),
 * drawn as you scroll, and each section lights up ([data-reached]) when the road arrives. The road
 * keeps to the margins (alternating sides on wide screens, the start edge on phones) and swaps
 * sides in the gaps between sections, so it never crosses the text. GSAP, ScrollTrigger and Lenis
 * load after first paint; with reduced motion the road is drawn whole and every stop is reached.
 */
export function Road({ startSelector }: { startSelector: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const line = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);

  useEffect(() => {
    const host = svg.current?.parentElement;
    if (!svg.current || !line.current || !glow.current || !host) return;
    const stops = [...host.querySelectorAll<HTMLElement>("[data-stop]")];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cleanup = () => {};
    let cancelled = false;

    const layout = () => {
      const box = host.getBoundingClientRect();
      const top = box.top + window.scrollY;
      const width = host.clientWidth;
      const height = host.scrollHeight;
      svg.current!.setAttribute("viewBox", `0 0 ${width} ${height}`);
      const rtl = getComputedStyle(host).direction === "rtl";
      const wide = width >= 900;
      const margin = Math.max(0, (width - 1200) / 2);
      const lane = wide ? Math.max(28, margin - 36) : 8;
      const side = (i: number) => {
        const startSide = wide && i % 2 === 1 ? width - lane : lane;
        return rtl ? width - startSide : startSide;
      };
      const start = document.querySelector<HTMLElement>(startSelector)?.getBoundingClientRect();
      const points: Point[] = [];
      if (start)
        points.push([start.left + start.width / 2 - box.left, start.bottom + window.scrollY - top]);
      stops.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const y0 = r.top + window.scrollY - top;
        points.push([side(i), y0 + 24], [side(i), y0 + r.height - 24]);
      });
      line.current!.setAttribute("d", pathThrough(points));
      glow.current!.setAttribute("d", pathThrough(points));
      return line.current!.getTotalLength();
    };

    let length = layout();
    const draw = (progress: number) => {
      const offset = (length * (1 - progress)).toFixed(1);
      line.current!.style.strokeDasharray = `${length}`;
      line.current!.style.strokeDashoffset = offset;
      glow.current!.style.strokeDasharray = `${length}`;
      glow.current!.style.strokeDashoffset = offset;
    };

    if (reduced) {
      draw(1);
      for (const el of stops) el.setAttribute("data-reached", "");
      return;
    }
    draw(0);
    host.setAttribute("data-road", "");

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("lenis")]).then(
      ([{ gsap }, { ScrollTrigger }, { default: Lenis }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        // Weighted, inertial wheel scrolling; touch keeps the platform's own scrolling.
        const lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
        lenis.on("scroll", ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);

        const state = { p: 0 };
        const tween = gsap.to(state, {
          p: 1,
          ease: "none",
          onUpdate: () => draw(state.p),
          scrollTrigger: {
            trigger: host,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.2,
            invalidateOnRefresh: true,
          },
        });
        const arrivals = stops.map((el) =>
          ScrollTrigger.create({
            trigger: el,
            start: "top 72%",
            onEnter: () => el.setAttribute("data-reached", ""),
          }),
        );
        const onRefresh = () => {
          length = layout();
          draw(state.p);
        };
        ScrollTrigger.addEventListener("refreshInit", onRefresh);
        const resize = new ResizeObserver(() => ScrollTrigger.refresh());
        resize.observe(host);
        void document.fonts?.ready.then(() => ScrollTrigger.refresh());

        cleanup = () => {
          resize.disconnect();
          ScrollTrigger.removeEventListener("refreshInit", onRefresh);
          for (const a of arrivals) a.kill();
          tween.scrollTrigger?.kill();
          tween.kill();
          gsap.ticker.remove(tick);
          lenis.destroy();
        };
      },
    );

    return () => {
      cancelled = true;
      host.removeAttribute("data-road");
      cleanup();
    };
  }, [startSelector]);

  return (
    <svg ref={svg} className={styles.road} aria-hidden="true" focusable="false">
      <path ref={glow} className={styles.glow} />
      <path ref={line} className={styles.line} />
    </svg>
  );
}
