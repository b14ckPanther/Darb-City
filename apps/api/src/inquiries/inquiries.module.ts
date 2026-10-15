import { Module } from "@nestjs/common";
import { RateLimiter } from "../search/rate-limiter.js";
import { InquiriesController, InquiriesService } from "./inquiries.controller.js";
import { Mailer } from "./mailer.js";

/** The /contact form: stored for the admin inbox, mailed to the founder. */
@Module({
  controllers: [InquiriesController],
  providers: [InquiriesService, Mailer, RateLimiter],
})
export class InquiriesModule {}
