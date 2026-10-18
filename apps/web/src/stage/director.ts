import { motion } from "@darb/tokens";
import {
  cameraFor,
  MOTION,
  pinsCamera,
  planTransition,
  viewFor,
  type CityDot,
  type PlazaLevel,
  type StageLevel,
  type StagePin,
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
  /** The businesses on the map now, and whether they mirror a numbered list. */
  private pins: readonly StagePin[] = [];
  private numbered = false;
  /** A business page's own pin: lifted for as long as the page is open. */
  private held: string | null = null;
  /** The category previewed on a place's map, by kind slug. */
  private previewing: string | null = null;

  constructor(private readonly deps: DirectorDeps) {
    activate(deps.layers, null);
  }

  attachMap(map: StageMap): void {
    this.map = map;
    map.setHeat(this.dots);
  }

  setDots(dots: readonly CityDot[]): void {
    this.dots = dots;
    this.map?.setHeat(dots);
  }

  get depth(): number | null {
    return this.shown ? this.shown.depth : null;
  }

  /** The kind previewed on the map now, if any. */
  get preview(): string | null {
    return this.previewing;
  }

  /** A business on the map now, with its list number (0 on a preview). */
  pinFor(key: string): { pin: StagePin; n: number } | null {
    const i = this.pins.findIndex((p) => p.key === key);
    if (i < 0) return null;
    return { pin: this.pins[i]!, n: this.numbered ? i + 1 : 0 };
  }

  /**
   * Lifts one business on the map (a hovered row or pin, a chosen pin), or none. A business page
   * keeps its own pin lifted whatever else is hovered.
   */
  lift(key: string | null): void {
    if (this.held !== null) return;
    const found = key === null ? null : this.pinFor(key);
    this.map?.setHot(found?.pin ?? null, found?.n ?? 0);
  }

  /**
   * Shows only one category's businesses on a place's map (levels 1 and 2), framed by the camera,
   * or (null) hands the map back to the place. Ignored anywhere else and for another place.
   */
  async showPreview(
    preview: { place: string; kind: string; pins: readonly StagePin[] } | null,
    insetBottom = 0,
  ): Promise<void> {
    const level = this.shown;
    if (!level || (level.depth !== 1 && level.depth !== 2)) return;
    if (preview && preview.place !== level.place.slug) return;
    if (!preview && this.previewing === null) return;
    this.previewing = preview?.kind ?? null;
    const pins = preview?.pins ?? [];
    this.pins = pins;
    this.numbered = false;
    this.map?.setHot(null, 0);
    this.map?.setPins(pins, false);
    // The place's own mark steps back while its businesses are on show.
    this.map?.setHere(preview ? null : level.place);
    const camera = (preview && pinsCamera(pins)) || cameraFor(level, this.dots);
    const duration = this.deps.reducedMotion() ? 0 : MOTION.move;
    await this.map?.move(camera, duration, 0, insetBottom);
  }

  async show(level: StageLevel, path: string): Promise<void> {
    const run = ++this.run;
    const { host, layers, fade, frame } = this.deps;
    // A business page (level 4) shows its own pin alone, lifted: the camera goes to it.
    const open = level.depth === 3 ? level.pins.findIndex((p) => p.href === path) : -1;
    const shownLevel: StageLevel =
      level.depth === 3 && open >= 0 ? { ...level, pins: [level.pins[open]!] } : level;
    const plan = planTransition(this.shown, shownLevel, this.dots, {
      reducedMotion: this.deps.reducedMotion(),
    });
    // A street map whose pins were only refreshed (revalidation) is not a new level: no re-fade.
    if (plan.fade?.kind === "through" && plan.view === "map" && refreshed(this.shown, shownLevel))
      plan.fade = null;
    const fromView = this.shown ? viewFor(this.shown) : null;
    this.shown = shownLevel;
    this.previewing = null;
    mark(host, {
      stageMoving: "",
      stageLevel: String(level.depth),
      stageView: plan.view,
      stageMotion: plan.motion,
      stageFade: String(plan.fade?.duration ?? 0),
      stagePlace: level.depth === 0 ? null : level.place.slug,
      stageActivePin: level.depth === 3 && open >= 0 ? level.pins[open]!.key : null,
    });
    const insetEnd = this.deps.insetEnd(level);
    const moveMap = (): Promise<void> => {
      this.drawLevel(level, open);
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

  /** What a level puts on the map: the place's mark, a kind's numbered pins, a business alone. */
  private drawLevel(level: StageLevel, open: number): void {
    const map = this.map;
    this.held = null;
    if (level.depth !== 3) {
      this.pins = [];
      this.numbered = false;
      map?.setHot(null, 0);
      map?.setPins([], false);
      map?.setHere(level.depth === 0 ? null : level.place);
      return;
    }
    map?.setHere(null);
    this.pins = level.pins;
    this.numbered = true;
    if (open >= 0) {
      // One pin for the business, lifted, with its number from the list.
      map?.setPins([], true);
      map?.setHot(level.pins[open]!, open + 1);
      this.held = level.pins[open]!.key;
    } else {
      map?.setHot(null, 0);
      map?.setPins(level.pins, true);
    }
  }
}
