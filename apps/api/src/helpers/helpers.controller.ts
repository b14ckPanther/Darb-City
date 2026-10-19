import { Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { contract, type FieldPhotoResultDto, type FieldReadResultDto } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { LocateAdmin } from "../admin/locate.admin.js";
import {
  HelperGuard,
  HelperReadGuard,
  SignedInGuard,
  type HelperRequest,
} from "../auth/helper.guard.js";
import { storePhoto, webpOf, type Res, type UploadRequest } from "../field/field.controller.js";
import { FieldService } from "../field/field.service.js";
import { MediaStore } from "../media/media.js";
import { HelpersService } from "./helpers.service.js";

type Req_ = HelperRequest & Res;
/** Phone numbers, names and the helper's own list: never cached anywhere. */
const noStore = (req: Res) => req.res?.setHeader("cache-control", "no-store");

/** Applying and the helper's own profile: anyone signed in. */
@Controller()
@UseGuards(SignedInGuard)
export class HelpersController {
  constructor(private readonly helpers: HelpersService) {}

  @TsRestHandler(contract.helpers.me)
  me(@Req() req: Req_) {
    noStore(req);
    return tsRestHandler(contract.helpers.me, async () => ({
      status: 200,
      body: await this.helpers.me(req.helper!),
    }));
  }

  @TsRestHandler(contract.helpers.apply)
  apply(@Req() req: Req_) {
    noStore(req);
    return tsRestHandler(contract.helpers.apply, async ({ body }) =>
      this.helpers.apply(req.helper!, body),
    );
  }

  @TsRestHandler(contract.helpers.update)
  update(@Req() req: Req_) {
    noStore(req);
    return tsRestHandler(contract.helpers.update, async ({ body }) =>
      this.helpers.update(req.helper!, body),
    );
  }
}

/**
 * Add from the street for helpers: the admin's field routes mounted a second time, on the same
 * FieldService. An approved helper (or an admin) adds; a paused one still reads their own list.
 */
@Controller()
export class HelperFieldController {
  constructor(
    private readonly field: FieldService,
    private readonly locator: LocateAdmin,
  ) {}

  @TsRestHandler(contract.helpers.field.status)
  @UseGuards(HelperGuard)
  status(@Req() req: Req_) {
    noStore(req);
    return tsRestHandler(contract.helpers.field.status, async () => ({
      status: 200,
      body: this.field.status(),
    }));
  }

  @TsRestHandler(contract.helpers.field.duplicates)
  @UseGuards(HelperGuard)
  duplicates(@Req() req: Req_) {
    noStore(req);
    return tsRestHandler(contract.helpers.field.duplicates, async ({ body }) => ({
      status: 200,
      body: { matches: await this.field.duplicates(body) },
    }));
  }

  @TsRestHandler(contract.helpers.field.create)
  @UseGuards(HelperGuard)
  create(@Req() req: Req_) {
    noStore(req);
    return tsRestHandler(contract.helpers.field.create, async ({ body }) =>
      this.field.create(req.helper!, body),
    );
  }

  @TsRestHandler(contract.helpers.field.mine)
  @UseGuards(HelperReadGuard)
  mine(@Req() req: Req_) {
    noStore(req);
    return tsRestHandler(contract.helpers.field.mine, async () => ({
      status: 200,
      body: await this.field.mine(req.helper!),
    }));
  }

  @TsRestHandler(contract.helpers.field.locate)
  @UseGuards(HelperGuard)
  locate(@Req() req: Req_) {
    noStore(req);
    return tsRestHandler(contract.helpers.field.locate, async ({ body }) => ({
      status: 200,
      body: await this.locator.locate(req.helper!, body),
    }));
  }
}

/** The storefront photo and the sign reading, as raw image bodies (like the admin's). */
@Controller()
@UseGuards(HelperGuard)
export class HelperFieldUploadsController {
  constructor(
    private readonly field: FieldService,
    private readonly media: MediaStore,
  ) {}

  @Post("helpers/field/photo")
  @HttpCode(201)
  async photo(@Req() req: UploadRequest): Promise<FieldPhotoResultDto> {
    return storePhoto(this.media, await webpOf(req));
  }

  /** A helper's own day of readings runs out first (HELPER_DAILY.reads). */
  @Post("helpers/field/read")
  @HttpCode(200)
  async read(@Req() req: UploadRequest & HelperRequest & Res): Promise<FieldReadResultDto> {
    noStore(req);
    return this.field.read(await webpOf(req), req.helper);
  }
}
