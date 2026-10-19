import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { MediaModule } from "../media/media.js";
import { AdminHelpersController, HelpersAdmin } from "./helpers.admin.js";
import {
  HelperFieldController,
  HelperFieldUploadsController,
  HelpersController,
} from "./helpers.controller.js";
import { HelpersService } from "./helpers.service.js";

/**
 * Darb Helpers: applying and the helper's profile (signed in), their street capture (approved
 * helpers and admins, on the admin's FieldService), and the admin's Helpers screen.
 */
@Module({
  imports: [AuthModule, AdminModule, MediaModule],
  controllers: [
    HelpersController,
    HelperFieldController,
    HelperFieldUploadsController,
    AdminHelpersController,
  ],
  providers: [HelpersService, HelpersAdmin],
})
export class HelpersModule {}
