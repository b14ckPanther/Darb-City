import { Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { AdminGuard } from "./admin.guard.js";
import { HelperGuard, HelperReadGuard, SignedInGuard } from "./helper.guard.js";
import { TOKEN_VERIFIER, verifierFor } from "./token-verifier.js";

@Module({
  providers: [
    {
      provide: TOKEN_VERIFIER,
      inject: [APP_CONFIG],
      useFactory: (c: AppConfig) => verifierFor(c.auth),
    },
    AdminGuard,
    HelperGuard,
    HelperReadGuard,
    SignedInGuard,
  ],
  exports: [TOKEN_VERIFIER, AdminGuard, HelperGuard, HelperReadGuard, SignedInGuard],
})
export class AuthModule {}
