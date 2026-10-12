import { motion } from "@darb/tokens";
import {
  planTransition,
  viewFor,
  type CityDot,
  type PlazaLevel,
  type StageLevel,
  type StageView,
} from "@darb/stage";
import type { Frame } from "./fade";
import type { StageMap } from "./types";

export interface DirectorDeps {
  /** Carries the data-stage-* state that e2e and CSS read. */
  host: HTMLElement;
  layers: Record<StageView, HTMLElement>;
  /** Renders a plaza scene (React state in Stage). */
  showPlaza: (level: PlazaLevel) => void;
  fade: (
    el: HTMLElement,
    from: Frame,
    to: Frame,
    duration: number,
    easing: string,
  ) => Promise<void>;
  /** Resolves after the next paint, so a newly rendered plaza can fade in. */
  frame: () => Promise<void>;
  reducedMotion: () => boolean;
  /** Px of the map hidden under the desktop sheet for this level. */
  insetEnd: (level: StageLevel) => number;
}

const SHOWN: Frame = { opacity: 1, scale: 1 };

function mark(host: HTMLElement, values: Record<string, string | null>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === null) delete host.dataset[key];
    else host.dataset[key] = value;
  }
}

/** The active layer takes pointer and focus; the other is inert and hidden from assistive tech. */
function activate(layers: Record<StageView, HTMLElement>, view: StageView | null): void {
  for (const [name, el] of Object.entries(layers)) {
    const on = name === view;
    el.toggleAttribute("data-active", on);
    el.toggleAttribute("inert", !on);
    if (on) el.removeAttribute("aria-hidden");
    else el.setAttribute("aria-hidden", "true");
  }
}

/**
 * The same street map with its pins refreshed (a revalidated page gained or lost a business): the
 * same place at depth 3, still sharing a business. A different kind there shares none.
 */
function refreshed(from: StageLevel | null, to: StageLevel): boolean {
  if (from?.depth !== 3 || to.depth !== 3 || from.place.slug !== to.place.slug) return false;
  const keys = new Set(to.pins.map((p) => p.key));
  return from.pins.some((p) => keys.has(p.key));
}

/**
 * Turns each level change into a camera move (spec §3.5): the map flies on the Darb ease-out while
 * the layers crossfade, or a plaza zooms through to the next. The content is already on screen
 * (the list renders first), so motion never blocks reading. One move at a time: a newer move
 * overtakes the running one, and only the last URL settles.
 */
export class Director {
  private shown: StageLevel | null = null;
  private run = 0;
  private map: StageMap | null = null;
  private dots: readonly CityDot[] = [];

  constructor(private readonly deps: DirectorDeps) {
    activate(deps.layers, null);
  }

  attachMap(map: StageMap): void {
    this.map = map;
    map.setDots(this.dots);
  }

  setDots(dots: readonly CityDot[]): void {
    this.dots = dots;
    this.map?.setDots(dots);
  }

  get depth(): number | null {
    return this.shown ? this.shown.depth : null;
  }

  async show(level: StageLevel, path: string): Promise<void> {
    const run = ++this.run;
    const { host, layers, fade, frame } = this.deps;
    const plan = planTransition(this.shown, level, this.dots, {
      reducedMotion: this.deps.reducedMotion(),
    });
    // A street map whose pins were only refreshed (revalidation) is not a new level: no re-fade.
    if (plan.fade?.kind === "through" && plan.view === "map" && refreshed(this.shown, level))
      plan.fade = null;
    const fromView = this.shown ? viewFor(this.shown) : null;
    this.shown = level;
    mark(host, {
      stageMoving: "",
      stageLevel: String(level.depth),
      stageView: plan.view,
      stageMotion: plan.motion,
      stageFade: String(plan.fade?.duration ?? 0),
      stagePlace: level.depth === 0 ? null : level.place.slug,
      stageActivePin:
        level.depth === 3 ? (level.pins.find((p) => p.href === path)?.key ?? null) : null,
    });
    const insetEnd = this.deps.insetEnd(level);
    const moveMap = (): Promise<void> => {
      this.map?.setPins(level.depth === 3 ? level.pins : [], path);
      return this.map ? this.map.move(plan.camera, plan.duration, insetEnd) : Promise.resolve();
    };
    const easing = motion.easeOut;
    const fadeIn: Frame = plan.fade ? { opacity: 0, scale: plan.fade.inScale } : SHOWN;
    const fadeOut: Frame = plan.fade ? { opacity: 0, scale: plan.fade.outScale } : SHOWN;
    let camera: Promise<unknown> = Promise.resolve();
    let fading: Promise<unknown> = Promise.resolve();

    if (plan.fade?.kind === "through") {
      // One layer fades (or zooms) out, changes scene in the dark and comes back: the plaza between
      // two scenes, or the map itself when reduced motion makes the camera jump.
      const half = plan.fade.duration / 2;
      const view = plan.view;
      const layer = layers[view];
      activate(layers, view);
      if (view === "plaza") camera = moveMap();
      fading = (async () => {
        await fade(layer, SHOWN, fadeOut, half, easing);
        if (run !== this.run) return;
        if (view === "plaza") this.deps.showPlaza(level as PlazaLevel);
        else await moveMap();
        await frame();
        if (run !== this.run) return;
        await fade(layer, fadeIn, SHOWN, half, easing);
      })();
    } else {
      camera = moveMap();
      if (plan.view === "plaza") {
        this.deps.showPlaza(level as PlazaLevel);
        await frame();
        if (run !== this.run) return;
      }
      activate(layers, plan.view);
      if (plan.fade) {
        const outgoing = fromView && fromView !== plan.view ? layers[fromView] : null;
        fading = Promise.all([
          fade(layers[plan.view], fadeIn, SHOWN, plan.fade.duration, easing),
          outgoing ? fade(outgoing, SHOWN, fadeOut, plan.fade.duration, easing) : null,
        ]);
      }
    }

    await Promise.all([camera, fading]);
    if (run !== this.run) return;
    for (const el of Object.values(layers))
      for (const animation of el.getAnimations?.() ?? []) animation.cancel();
    mark(host, { stageMoving: null, stagePath: path });
  }
}
