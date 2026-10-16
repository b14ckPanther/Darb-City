import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, Module } from "@nestjs/common";
import { AwsClient } from "aws4fetch";
import sharp from "sharp";
import { APP_CONFIG, type AppConfig } from "../config.js";

/** The largest upload taken, before any resizing. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export type ImageVariant = "photo" | "logo";
const LONG_SIDE: Record<ImageVariant, number> = { photo: 1600, logo: 512 };
const FORMATS = new Set(["jpeg", "png", "webp", "heif"]);

/**
 * Any accepted image to a WebP: the format is read from the bytes themselves (never the name or
 * the declared type), turned upright, shrunk to 1600 px on its long side (512 for a logo) and
 * written without its metadata (no GPS, no camera). Null when it is not an image sharp can read
 * (HEIC from an iPhone needs a libvips with HEVC, which the prebuilt one lacks).
 */
export async function toWebp(input: Uint8Array, variant: ImageVariant): Promise<Buffer | null> {
  try {
    const meta = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
    if (!meta.format || !FORMATS.has(meta.format)) return null;
    const side = LONG_SIDE[variant];
    return await sharp(input, { limitInputPixels: 50_000_000, failOn: "error" })
      .rotate()
      .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return null;
  }
}

/** A fresh key for an upload that waits for review. */
export const pendingKey = () => `pending/${randomUUID()}.webp`;

/**
 * Cloudflare R2 through its S3 API, signed with aws4fetch (no SDK). Off when R2's credentials are
 * not set: uploads answer 503 and the forms hide their photo steps. Deletes and existence checks
 * never throw.
 */
@Injectable()
export class MediaStore {
  private readonly logger = new Logger(MediaStore.name);
  private readonly aws: AwsClient | null;
  fetchImpl: typeof fetch = fetch;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    const r2 = config.join.r2;
    this.aws = r2
      ? new AwsClient({
          accessKeyId: r2.accessKeyId,
          secretAccessKey: r2.secretAccessKey,
          service: "s3",
          region: "auto",
        })
      : null;
  }

  get enabled(): boolean {
    return this.aws !== null;
  }

  /** Where the public sees a key (MEDIA_URL, the bucket's custom domain). */
  url(key: string): string {
    return `${this.config.join.mediaUrl}/${key}`;
  }

  private endpoint(key: string): string {
    const { r2, bucket } = this.config.join;
    return `https://${r2!.accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
  }

  private async send(key: string, init: RequestInit): Promise<Response> {
    const signed = await this.aws!.sign(this.endpoint(key), init);
    return this.fetchImpl(signed, { signal: AbortSignal.timeout(10_000) });
  }

  async put(key: string, body: Buffer): Promise<boolean> {
    if (!this.aws) return false;
    try {
      const res = await this.send(key, {
        method: "PUT",
        body: new Uint8Array(body),
        headers: {
          "content-type": "image/webp",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
      if (res.ok) return true;
      this.logger.warn(`R2 answered ${res.status} to a PUT`);
    } catch {
      this.logger.warn("R2 could not be reached for a PUT");
    }
    return false;
  }

  async exists(key: string): Promise<boolean> {
    if (!this.aws) return false;
    try {
      return (await this.send(key, { method: "HEAD" })).ok;
    } catch {
      return false;
    }
  }

  async remove(keys: string[]): Promise<void> {
    if (!this.aws) return;
    await Promise.all(
      keys.map(async (key) => {
        try {
          const res = await this.send(key, { method: "DELETE" });
          if (!res.ok && res.status !== 404)
            this.logger.warn(`R2 answered ${res.status} to a DELETE`);
        } catch {
          this.logger.warn("R2 could not be reached for a DELETE");
        }
      }),
    );
  }
}

@Module({ providers: [MediaStore], exports: [MediaStore] })
export class MediaModule {}
