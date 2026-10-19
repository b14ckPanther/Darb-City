import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { signedInUser } from "./signed-in.js";
import { TOKEN_VERIFIER, type TokenVerifier } from "./token-verifier.js";

export interface AdminActor {
  userId: string;
  clerkUserId: string;
}
export interface AdminRequest {
  headers: Record<string, string | string[] | undefined>;
  admin?: AdminActor;
}

/** Spec §6.2: signed in (signedInUser), and User.isAdmin. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const user = await signedInUser(req.headers, {
      verifier: this.verifier,
      prisma: this.prisma,
      config: this.config,
    });
    if (!user.isAdmin) throw new ForbiddenException("This account is not a Darb admin");
    req.admin = { userId: user.id, clerkUserId: user.clerkUserId };
    return true;
  }
}
