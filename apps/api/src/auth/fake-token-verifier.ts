import { InvalidTokenError, type TokenVerifier, type VerifiedToken } from "./token-verifier.js";

/**
 * Tests and local e2e only (config refuses AUTH_VERIFIER=fake in production):
 * "fake.<sub>[.<email>[.unverified]]". Emails here never contain a dot-separated "unverified".
 */
export class FakeTokenVerifier implements TokenVerifier {
  async verify(token: string): Promise<VerifiedToken> {
    const m = /^fake\.([A-Za-z0-9_]+)(?:\.(.+?))?(\.unverified)?$/.exec(token);
    if (!m) throw new InvalidTokenError("Not a fake token");
    const email = m[2] ? m[2].toLowerCase() : null;
    return { sub: m[1]!, email, emailVerified: email !== null && !m[3] };
  }
}
