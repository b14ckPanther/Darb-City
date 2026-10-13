import { verifyToken } from "@clerk/backend";
import type { AuthConfig } from "../config.js";
import { InvalidTokenError, type TokenVerifier, type VerifiedToken } from "./token-verifier.js";

/** Verifies Clerk session JWTs (spec §6.4: Clerk is admin-only in v1). Never logs the token. */
export class ClerkTokenVerifier implements TokenVerifier {
  constructor(
    private readonly auth: AuthConfig,
    private readonly verifyImpl: typeof verifyToken = verifyToken,
  ) {}

  async verify(token: string): Promise<VerifiedToken> {
    const key = this.auth.clerkJwtKey
      ? { jwtKey: this.auth.clerkJwtKey }
      : { secretKey: this.auth.clerkSecretKey ?? "" };
    const parties = this.auth.authorizedParties.length
      ? { authorizedParties: this.auth.authorizedParties }
      : {};
    try {
      const claims = (await this.verifyImpl(token, { ...key, ...parties })) as Record<
        string,
        unknown
      >;
      const sub = typeof claims["sub"] === "string" ? claims["sub"] : "";
      if (!sub) throw new Error("no subject");
      const email = typeof claims["email"] === "string" ? claims["email"].toLowerCase() : null;
      return { sub, email, emailVerified: claims["email_verified"] === true };
    } catch {
      throw new InvalidTokenError("Invalid or expired session");
    }
  }
}
