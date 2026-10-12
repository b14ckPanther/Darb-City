import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { parseRange } from "@/lib/byte-range";

/** Archive names only: no paths, so nothing outside the tiles folder can be read. */
const NAME = /^[a-z0-9-]+\.pmtiles$/;

type Context = { params: Promise<{ name: string }> };

/**
 * PMTiles archives (the Israel extract, or the e2e fixture) from MAP_TILES_DIR, with HTTP Range.
 * For development and self-hosting; production points NEXT_PUBLIC_MAP_TILES_URL at R2 (Plan 4).
 */
async function serve(request: Request, name: string, withBody: boolean): Promise<Response> {
  if (!NAME.test(name)) return new Response(null, { status: 404 });
  const file = path.join(path.resolve(process.cwd(), process.env.MAP_TILES_DIR ?? ".tiles"), name);
  let size: number;
  let modified: number;
  try {
    const info = await stat(file);
    if (!info.isFile()) return new Response(null, { status: 404 });
    size = info.size;
    modified = Math.floor(info.mtimeMs);
  } catch {
    return new Response(null, { status: 404 });
  }
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Type": "application/octet-stream",
    "Cache-Control": "public, max-age=3600",
    ETag: `"${size.toString(16)}-${modified.toString(16)}"`,
  });
  const range = parseRange(request.headers.get("range"), size);
  if (range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  headers.set("Content-Length", String(Math.max(0, end - start + 1)));
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  const body =
    withBody && size > 0
      ? (Readable.toWeb(
          createReadStream(file, { start, end }),
        ) as unknown as ReadableStream<Uint8Array>)
      : null;
  return new Response(body, { status: range ? 206 : 200, headers });
}

export async function GET(request: Request, { params }: Context): Promise<Response> {
  return serve(request, (await params).name, true);
}

export async function HEAD(request: Request, { params }: Context): Promise<Response> {
  return serve(request, (await params).name, false);
}
