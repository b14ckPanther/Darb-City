import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TOKEN_VERIFIER, type TokenVerifier } from "./token-verifier.js";

export interface AdminActor {
  userId: string;
  clerkUserId: string;
}
export interface AdminRequest {
  headers: Record<string, string | string[] | undefined>;
  admin?: AdminActor;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Spec §6.2: Clerk proves who someone is; User.isAdmin decides. ADMIN_EMAILS grants the flag only
 * when the User row is first created and only for a verified email; after that, the CLI decides.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const token = /^Bearer\s+(\S+)$/i.exec(first(req.headers["authorization"]))?.[1];
    if (!token) throw new UnauthorizedException("Sign in to continue");
    const claims = await this.verifier.verify(token).catch(() => {
      throw new UnauthorizedException("Your session has ended; sign in again");
    });
    const allowlisted =
      claims.email !== null &&
      claims.emailVerified &&
      this.config.auth.adminEmails.includes(claims.email);
    const user = await this.userFor(claims.sub, allowlisted);
    if (!user.isAdmin) throw new ForbiddenException("This account is not a Darb admin");
    req.admin = { userId: user.id, clerkUserId: user.clerkUserId };
    return true;
  }

  /**
   * The User row, created at first sight. Concurrent first requests (parallel page fetches right
   * after sign-in) race on the clerkUserId key: the losers re-read the winner's row instead of 500ing.
   */
  private async userFor(clerkUserId: string, allowlisted: boolean) {
    try {
      return await this.prisma.user.upsert({
        where: { clerkUserId },
        create: { clerkUserId, isAdmin: allowlisted },
        update: {},
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
        return this.prisma.user.findUniqueOrThrow({ where: { clerkUserId } });
      throw err;
    }
  }
}
