/** The phone's photo before it leaves: at most this many pixels on its long side, as a JPEG. */
export const MAX_SIDE = 1600;
export const QUALITY = 0.8;

/** The size that fits within MAX_SIDE, never enlarged. */
export function fitWithin(width: number, height: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * A camera photo (often 4000 px and several MB) as a ~1600 px JPEG, turned upright: a fraction of
 * the bytes on a weak signal. Anything the browser cannot draw is sent as it is (the API shrinks
 * and checks it anyway).
 */
export async function downscale(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    return out && out.size > 0 ? out : file;
  } catch {
    return file;
  }
}
