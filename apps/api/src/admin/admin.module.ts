import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { SearchIndexModule } from "../search/search-index.module.js";
import { AdminWriter } from "./admin-writer.js";
import { ReportRepository } from "../search/report.repository.js";
import { AdminBusinessesController, BusinessesAdmin } from "./businesses.admin.js";
import { ExperienceValidator } from "./experience.js";
import { AdminMiscController, MiscAdmin } from "./misc.admin.js";
import { AdminKindsController, KindsAdmin } from "./kinds.admin.js";
import { AdminPlacesController, PlacesAdmin } from "./places.admin.js";
import { AdminSectorsController, SectorsAdmin } from "./sectors.admin.js";
import { WebRevalidator } from "./revalidator.js";

/** Spec §6.2 Admin: guarded by Clerk and the admin flag. */
@Module({
  imports: [AuthModule, SearchIndexModule],
  controllers: [
    AdminPlacesController,
    AdminSectorsController,
    AdminKindsController,
    AdminBusinessesController,
    AdminMiscController,
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
    ReportRepository,
  ],
  exports: [AdminWriter, WebRevalidator],
})
export class AdminModule {}
