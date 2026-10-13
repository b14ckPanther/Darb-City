import type { AuthConfig } from "../config.js";
import { ClerkTokenVerifier } from "./clerk-token-verifier.js";
import { FakeTokenVerifier } from "./fake-token-verifier.js";

export interface VerifiedToken {
  sub: string;
  email: string | null;
  emailVerified: boolean;
}

export interface TokenVerifier {
  verify(token: string): Promise<VerifiedToken>;
}

export const TOKEN_VERIFIER = Symbol("TOKEN_VERIFIER");
export class InvalidTokenError extends Error {
  override name = "InvalidTokenError";
}

/** Without Clerk keys the admin API is closed: every token is refused. */
class OffVerifier implements TokenVerifier {
  async verify(): Promise<VerifiedToken> {
    throw new InvalidTokenError("Admin sign-in is not configured");
  }
}

export function verifierFor(auth: AuthConfig): TokenVerifier {
  if (auth.verifier === "fake") return new FakeTokenVerifier();
  if (auth.verifier === "clerk") return new ClerkTokenVerifier(auth);
  return new OffVerifier();
}
