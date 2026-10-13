import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { SearchIndexModule } from "../search/search-index.module.js";
import { AdminWriter } from "./admin-writer.js";
import { AdminKindsController, KindsAdmin } from "./kinds.admin.js";
import { AdminPlacesController, PlacesAdmin } from "./places.admin.js";
import { AdminSectorsController, SectorsAdmin } from "./sectors.admin.js";
import { WebRevalidator } from "./revalidator.js";

/** Spec §6.2 Admin: guarded by Clerk and the admin flag. Tasks 15–17 add services and controllers. */
@Module({
  imports: [AuthModule, SearchIndexModule],
  controllers: [AdminPlacesController, AdminSectorsController, AdminKindsController],
  providers: [AdminWriter, WebRevalidator, PlacesAdmin, SectorsAdmin, KindsAdmin],
  exports: [AdminWriter, WebRevalidator],
})
export class AdminModule {}
