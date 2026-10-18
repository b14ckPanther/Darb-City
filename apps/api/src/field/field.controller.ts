import {
  Controller,
  HttpCode,
  HttpException,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { contract, type FieldPhotoResultDto, type FieldReadResultDto } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminRequest } from "../auth/admin.guard.js";
import { MAX_UPLOAD_BYTES, MediaStore, pendingKey, toWebp } from "../media/media.js";
import { FieldService } from "./field.service.js";

type UploadRequest = AdminRequest & AsyncIterable<Buffer>;
type Res = { res?: { setHeader(k: string, v: string): void } };

/** The request body as one image, refused past MAX_UPLOAD_BYTES and when it is not an image. */
async function webpOf(req: UploadRequest): Promise<Buffer> {
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
  const webp = await toWebp(Buffer.concat(chunks), "photo");
  if (!webp) throw new HttpException({ message: "Not an image", reason: "not-image" }, 400);
  return webp;
}

/**
 * Add from the street, for admins only. The photo and the sign reading take the image as the raw
 * request body (the web's /admin/field-api routes forward the browser's file alone).
 */
@Controller()
@UseGuards(AdminGuard)
export class AdminFieldUploadsController {
  constructor(
    private readonly field: FieldService,
    private readonly media: MediaStore,
  ) {}

  /** The storefront photo, kept under pending/ like a /join photo; null when uploads are off. */
  @Post("admin/field/photo")
  @HttpCode(201)
  async photo(@Req() req: UploadRequest): Promise<FieldPhotoResultDto> {
    const webp = await webpOf(req);
    if (!this.media.enabled) return { key: null };
    const key = pendingKey();
    if (!(await this.media.put(key, webp)))
      throw new ServiceUnavailableException({ reason: "storage" });
    return { key };
  }

  /** Reads the sign. The image goes to the model as the metadata-free WebP, never the original. */
  @Post("admin/field/read")
  @HttpCode(200)
  async read(@Req() req: UploadRequest & Res): Promise<FieldReadResultDto> {
    req.res?.setHeader("cache-control", "no-store");
    return this.field.read(await webpOf(req));
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminFieldController {
  constructor(private readonly field: FieldService) {}

  @TsRestHandler(contract.admin.field)
  handler(@Req() req: AdminRequest & Res) {
    const actor = req.admin!;
    // Captures carry business phone numbers and the admin's own list: never cached anywhere.
    req.res?.setHeader("cache-control", "no-store");
    return tsRestHandler(contract.admin.field, {
      status: async () => ({ status: 200, body: this.field.status() }),
      duplicates: async ({ body }) => ({
        status: 200,
        body: { matches: await this.field.duplicates(body) },
      }),
      create: async ({ body }) => this.field.create(actor, body),
      mine: async () => ({ status: 200, body: await this.field.mine(actor) }),
    });
  }
}
