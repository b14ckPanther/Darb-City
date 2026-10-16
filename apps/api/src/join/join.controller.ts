import {
  Controller,
  HttpCode,
  HttpException,
  Inject,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import { contract, type JoinPhotoDto } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { MAX_UPLOAD_BYTES, MediaStore, pendingKey, toWebp } from "../media/media.js";
import { clientIp, type ClientRequest } from "../search/client-ip.js";
import { RateLimiter } from "../search/rate-limiter.js";
import { JoinService } from "./join.service.js";

const HOUR = 3600;
const tooMany = (retryAfter: number) => ({
  status: 429 as const,
  body: { message: "Too many tries, try again later", retryAfter },
});

@Controller()
export class JoinController {
  constructor(
    private readonly join: JoinService,
    private readonly media: MediaStore,
    private readonly limiter: RateLimiter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @TsRestHandler(contract.join)
  handler(@Req() req: ClientRequest) {
    const ip = () => clientIp(req, this.config.search.proxyKey);
    const { lookupRateLimit, rateLimit } = this.config.join;
    return tsRestHandler(contract.join, {
      status: async () => ({
        status: 200,
        body: { uploads: this.media.enabled, lookup: this.join.lookupOn },
      }),
      lookup: async ({ body }) => {
        const gate = await this.limiter.hit("lookup", ip(), lookupRateLimit, HOUR);
        if (!gate.ok) return tooMany(gate.retryAfter);
        return { status: 200, body: await this.join.lookup(body) };
      },
      create: async ({ body }) => {
        const gate = await this.limiter.hit("join", ip(), rateLimit, HOUR);
        if (!gate.ok) return tooMany(gate.retryAfter);
        // A filled honeypot is a bot: it hears the same answer, and nothing is kept.
        if (body.website2?.trim()) return { status: 201, body: { ok: true as const } };
        const done = await this.join.create(body, ip());
        if (done !== "ok")
          return {
            status: 400,
            body: { message: done === "unknown_place" ? "No such town" : "No such kind" },
          };
        return { status: 201, body: { ok: true as const } };
      },
    });
  }
}

type UploadRequest = ClientRequest & AsyncIterable<Buffer>;

/**
 * POST /join/photos: one image as the raw request body (the web's /api/join/photos reads the
 * browser's multipart form and forwards the file alone), ?variant=logo for a logo. Answers the
 * pending key the form sends back with the rest.
 */
@Controller()
export class JoinPhotosController {
  constructor(
    private readonly media: MediaStore,
    private readonly limiter: RateLimiter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post("join/photos")
  @HttpCode(201)
  async upload(
    @Req() req: UploadRequest,
    @Query("variant") variant?: string,
  ): Promise<JoinPhotoDto> {
    if (!this.media.enabled) throw new ServiceUnavailableException({ reason: "uploads-off" });
    const ip = clientIp(req, this.config.search.proxyKey);
    const gate = await this.limiter.hit("upload", ip, this.config.join.uploadRateLimit, HOUR);
    if (!gate.ok)
      throw new HttpException({ message: "Too many photos", retryAfter: gate.retryAfter }, 429);
    const declared = Number(req.headers["content-length"] ?? 0);
    if (declared > MAX_UPLOAD_BYTES)
      throw new HttpException({ message: "Too large", reason: "too-large" }, 413);
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES)
        throw new HttpException({ message: "Too large", reason: "too-large" }, 413);
      chunks.push(chunk);
    }
    const webp = await toWebp(Buffer.concat(chunks), variant === "logo" ? "logo" : "photo");
    if (!webp) throw new HttpException({ message: "Not an image", reason: "not-image" }, 400);
    const key = pendingKey();
    if (!(await this.media.put(key, webp)))
      throw new ServiceUnavailableException({ reason: "storage" });
    return { key, url: this.media.url(key) };
  }
}
