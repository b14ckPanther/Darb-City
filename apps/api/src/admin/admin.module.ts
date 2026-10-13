import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { SearchIndexModule } from "../search/search-index.module.js";
import { AdminWriter } from "./admin-writer.js";
import { WebRevalidator } from "./revalidator.js";

/** Spec §6.2 Admin: guarded by Clerk and the admin flag. Tasks 15–17 add services and controllers. */
@Module({
  imports: [AuthModule, SearchIndexModule],
  providers: [AdminWriter, WebRevalidator],
  exports: [AdminWriter, WebRevalidator],
})
export class AdminModule {}
