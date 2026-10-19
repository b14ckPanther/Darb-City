import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config.js";
import type { HelperStatus } from "../generated/prisma/enums.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AdminActor, AdminRequest } from "./admin.guard.js";
import { signedInUser } from "./signed-in.js";
import { TOKEN_VERIFIER, type TokenVerifier } from "./token-verifier.js";

/**
 * Whoever is signed in, as the helper routes see them. `limited` is a helper who is not an admin:
 * the day's caps and the duplicate note apply to them (admins keep today's limits).
 */
export interface HelperActor extends AdminActor {
  isAdmin: boolean;
  helperStatus: HelperStatus;
  limited: boolean;
}
export interface HelperRequest extends AdminRequest {
  helper?: HelperActor;
}

abstract class SignedIn implements CanActivate {
  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Whether this signed-in person may go on; false answers 403. */
  protected abstract allows(actor: HelperActor): boolean;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HelperRequest>();
    const user = await signedInUser(req.headers, {
      verifier: this.verifier,
      prisma: this.prisma,
      config: this.config,
    });
    const actor: HelperActor = {
      userId: user.id,
      clerkUserId: user.clerkUserId,
      isAdmin: user.isAdmin,
      helperStatus: user.helperStatus,
      limited: !user.isAdmin,
    };
    if (!this.allows(actor)) throw new ForbiddenException("This account is not an active helper");
    req.helper = actor;
    return true;
  }
}

/** Any signed-in Clerk user: applying, and reading or editing their own helper profile. */
@Injectable()
export class SignedInGuard extends SignedIn {
  protected allows(): boolean {
    return true;
  }
}

/** An approved helper, or an admin (admins are helpers too, without applying). */
@Injectable()
export class HelperGuard extends SignedIn {
  protected allows(a: HelperActor): boolean {
    return a.isAdmin || a.helperStatus === "approved";
  }
}

/** Their own additions stay readable while paused (status only, nothing new). */
@Injectable()
export class HelperReadGuard extends SignedIn {
  protected allows(a: HelperActor): boolean {
    return a.isAdmin || a.helperStatus === "approved" || a.helperStatus === "paused";
  }
}
