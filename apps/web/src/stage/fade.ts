export interface Frame {
  opacity: number;
  scale: number;
}

const keyframe = ({ opacity, scale }: Frame): Keyframe => ({
  opacity,
  transform: scale === 1 ? "none" : `scale(${scale})`,
});

/**
 * Fades and scales a layer with the Web Animations API (only opacity and transform, spec §3.5).
 * Holds the last frame until the Director cancels it, then the layer's CSS state takes over.
 */
export function fadeLayer(
  el: HTMLElement,
  from: Frame,
  to: Frame,
  duration: number,
  easing: string,
): Promise<void> {
  if (duration <= 0 || typeof el.animate !== "function") return Promise.resolve();
  return el
    .animate([keyframe(from), keyframe(to)], { duration, easing, fill: "forwards" })
    .finished.then(
      () => undefined,
      () => undefined,
    );
}

export const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));
