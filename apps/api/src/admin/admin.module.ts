import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { SearchIndexModule } from "../search/search-index.module.js";
import { AdminWriter } from "./admin-writer.js";
import { ReportRepository } from "../search/report.repository.js";
import { AdminBusinessesController, BusinessesAdmin } from "./businesses.admin.js";
import { ExperienceValidator } from "./experience.js";
import { AdminInquiriesController, InquiriesAdmin } from "./inquiries.admin.js";
import { AdminJoinController, JoinAdmin } from "./join.admin.js";
import { AdminFieldController, AdminFieldUploadsController } from "../field/field.controller.js";
import { FieldService } from "../field/field.service.js";
import { SIGN_READER, signReaderFor } from "../field/sign-reader.js";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { ModelBudget } from "../search/model-budget.js";
import { MediaModule } from "../media/media.js";
import { AdminMiscController, MiscAdmin } from "./misc.admin.js";
import { AdminKindsController, KindsAdmin } from "./kinds.admin.js";
import { AdminPlacesController, PlacesAdmin } from "./places.admin.js";
import { AdminPlansController, PlansAdmin } from "./plans.admin.js";
import { AdminSectorsController, SectorsAdmin } from "./sectors.admin.js";
import { WebRevalidator } from "./revalidator.js";
import { AdminTextsController, TextsAdmin } from "./texts.admin.js";
import { JoinModule } from "../join/join.module.js";
import { RateLimiter } from "../search/rate-limiter.js";
import { AdminLocateController, LocateAdmin } from "./locate.admin.js";
import { Overpass } from "./locate/overpass.js";

/** Spec §6.2 Admin: guarded by Clerk and the admin flag. */
@Module({
  imports: [AuthModule, SearchIndexModule, MediaModule, JoinModule],
  controllers: [
    AdminPlacesController,
    AdminSectorsController,
    AdminKindsController,
    AdminBusinessesController,
    AdminMiscController,
    AdminPlansController,
    AdminTextsController,
    AdminInquiriesController,
    AdminJoinController,
    AdminFieldController,
    AdminFieldUploadsController,
    AdminLocateController,
  ],
  providers: [
    AdminWriter,
    WebRevalidator,
    PlacesAdmin,
    SectorsAdmin,
    KindsAdmin,
    BusinessesAdmin,
    ExperienceValidator,
    MiscAdmin,
    PlansAdmin,
    TextsAdmin,
    InquiriesAdmin,
    JoinAdmin,
    ReportRepository,
    FieldService,
    ModelBudget,
    LocateAdmin,
    Overpass,
    RateLimiter,
    {
      provide: SIGN_READER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        signReaderFor({ ...config.field, apiKey: config.search.anthropicApiKey }),
    },
  ],
  exports: [AdminWriter, WebRevalidator],
})
export class AdminModule {}
