import { createHmac, timingSafeEqual } from "node:crypto";

export const CLIENT_EMAIL_VERIFICATION_COOKIE = "client_email_verification";
export const EMAIL_CODE_TTL_SECONDS = 10 * 60;
export const VERIFIED_EMAIL_TTL_SECONDS = 30 * 60;
export const MAX_EMAIL_CODE_ATTEMPTS = 5;

export type EmailVerificationState = {
  email: string;
  codeHash: string;
  nonce: string;
  expiresAt: number;
  attempts: number;
  verified: boolean;
};

function verificationSecret() {
  const secret = process.env.CLIENT_EMAIL_VERIFICATION_SECRET?.trim() || process.env.SMTP_PASSWORD?.trim();
  if (!secret) throw new Error("Configure CLIENT_EMAIL_VERIFICATION_SECRET or SMTP_PASSWORD on the server.");
  return secret;
}

function signature(payload: string) {
  return createHmac("sha256", verificationSecret()).update(payload).digest("base64url");
}

export function signEmailVerificationState(state: EmailVerificationState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function readEmailVerificationState(token?: string | null): EmailVerificationState | null {
  if (!token) return null;
  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra) return null;
  try {
    const expected = Buffer.from(signature(payload));
    const provided = Buffer.from(providedSignature);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as EmailVerificationState;
    if (typeof state.email !== "string" || typeof state.codeHash !== "string" ||
      typeof state.nonce !== "string" || typeof state.expiresAt !== "number" ||
      typeof state.attempts !== "number" || typeof state.verified !== "boolean") return null;
    return state;
  } catch {
    return null;
  }
}

export function hashEmailVerificationCode(email: string, nonce: string, code: string) {
  return createHmac("sha256", verificationSecret()).update(`${email}:${nonce}:${code}`).digest("hex");
}

export function isSameEmail(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function codeHashMatches(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
