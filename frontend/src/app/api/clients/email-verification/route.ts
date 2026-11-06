import { randomInt, randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import {
  CLIENT_EMAIL_VERIFICATION_COOKIE,
  EMAIL_CODE_TTL_SECONDS,
  MAX_EMAIL_CODE_ATTEMPTS,
  VERIFIED_EMAIL_TTL_SECONDS,
  codeHashMatches,
  hashEmailVerificationCode,
  isSameEmail,
  readEmailVerificationState,
  signEmailVerificationState,
  type EmailVerificationState
} from "@/lib/clientEmailVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEND_WINDOW_MS = 15 * 60 * 1000;
const sendWindows = new Map<string, number[]>();

class VerificationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" }
  });
}

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== request.nextUrl.origin) {
    throw new VerificationError("Email verification requests must come from this application.", 403);
  }
}

function setVerificationCookie(responseObject: NextResponse, token: string, maxAge: number) {
  responseObject.cookies.set(CLIENT_EMAIL_VERIFICATION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/clients",
    maxAge
  });
}

function clearVerificationCookie(responseObject: NextResponse) {
  responseObject.cookies.set(CLIENT_EMAIL_VERIFICATION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/clients",
    maxAge: 0
  });
}

function checkSendLimits(email: string, request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const keys = [`email:${email}`, `ip:${ip}`];
  const limits = [3, 10];
  for (let index = 0; index < keys.length; index += 1) {
    const recent = (sendWindows.get(keys[index]) || []).filter((time) => now - time < SEND_WINDOW_MS);
    if (recent.length >= limits[index]) throw new VerificationError("Too many verification emails were requested. Try again in 15 minutes.", 429);
    sendWindows.set(keys[index], [...recent, now]);
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new VerificationError(`Email verification is not configured: add ${name} to the server environment.`, 503);
  return value;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

async function sendVerificationCode(email: string, code: string) {
  const host = requiredEnv("SMTP_HOST");
  const port = Number(requiredEnv("SMTP_PORT"));
  const user = requiredEnv("SMTP_USER");
  const pass = requiredEnv("SMTP_PASSWORD");
  const from = requiredEnv("SMTP_FROM");
  const fromName = process.env.SMTP_FROM_NAME?.trim() || "Business Operations";
  const replyTo = process.env.SMTP_REPLY_TO?.trim();
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new VerificationError("SMTP_PORT must be a valid port number.", 503);
  if (!process.env.CLIENT_EMAIL_VERIFICATION_SECRET?.trim() && !pass) {
    throw new VerificationError("Configure CLIENT_EMAIL_VERIFICATION_SECRET or SMTP_PASSWORD on the server.", 503);
  }

  const secure = process.env.SMTP_SECURE?.trim().toLowerCase() === "true";
  const transporter = nodemailer.createTransport({
    host, port, secure, requireTLS: !secure,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  });
  await transporter.sendMail({
    from: { name: fromName, address: from },
    ...(replyTo ? { replyTo } : {}),
    to: email,
    subject: "Verify your email address",
    text: `Your email verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this message.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#172033"><p style="color:#a16207;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Email verification</p><h1 style="font-size:24px">Confirm your email address</h1><p>Enter this code to finish adding your organization to ${escapeHtml(fromName)}:</p><div style="font-size:32px;letter-spacing:8px;font-weight:700;padding:18px 20px;background:#f5f7fb;border:1px solid #e5eaf2;border-radius:12px;text-align:center">${code}</div><p>This code expires in 10 minutes. If you did not request it, ignore this message.</p></div>`
  });
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    const action = body?.action;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new VerificationError("Enter a valid email address.", 400);

    if (action === "send") {
      if (!process.env.CLIENT_EMAIL_VERIFICATION_SECRET?.trim() && !process.env.SMTP_PASSWORD?.trim()) {
        throw new VerificationError("Email verification is not configured: add CLIENT_EMAIL_VERIFICATION_SECRET or SMTP_PASSWORD to the server environment.", 503);
      }
      checkSendLimits(email, request);
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const state: EmailVerificationState = {
        email,
        nonce: randomUUID(),
        codeHash: "",
        expiresAt: Date.now() + EMAIL_CODE_TTL_SECONDS * 1000,
        attempts: 0,
        verified: false
      };
      state.codeHash = hashEmailVerificationCode(email, state.nonce, code);
      await sendVerificationCode(email, code);
      const result = response({ success: true, message: "Verification code sent. Check the inbox and spam folder." });
      setVerificationCookie(result, signEmailVerificationState(state), EMAIL_CODE_TTL_SECONDS);
      return result;
    }

    if (action === "verify") {
      const current = readEmailVerificationState(request.cookies.get(CLIENT_EMAIL_VERIFICATION_COOKIE)?.value);
      if (!current || current.verified || current.expiresAt < Date.now() || !isSameEmail(current.email, email)) {
        throw new VerificationError("This code has expired or belongs to a different email. Request a new code.", 400);
      }
      const code = typeof body.code === "string" ? body.code.trim() : "";
      if (!/^\d{6}$/.test(code)) throw new VerificationError("Enter the 6-digit code from the email.", 400);
      if (!codeHashMatches(hashEmailVerificationCode(email, current.nonce, code), current.codeHash)) {
        const attempts = current.attempts + 1;
        const result = response({ error: attempts >= MAX_EMAIL_CODE_ATTEMPTS ? "Too many incorrect codes. Request a new code." : `That code is incorrect. ${MAX_EMAIL_CODE_ATTEMPTS - attempts} attempts remain.` }, 400);
        if (attempts >= MAX_EMAIL_CODE_ATTEMPTS) clearVerificationCookie(result);
        else setVerificationCookie(result, signEmailVerificationState({ ...current, attempts }), EMAIL_CODE_TTL_SECONDS);
        return result;
      }

      const verifiedState = { ...current, verified: true, expiresAt: Date.now() + VERIFIED_EMAIL_TTL_SECONDS * 1000 };
      const result = response({ success: true, message: "Email verified. You can now create the client." });
      setVerificationCookie(result, signEmailVerificationState(verifiedState), VERIFIED_EMAIL_TTL_SECONDS);
      return result;
    }

    throw new VerificationError("Unknown email verification action.", 400);
  } catch (error) {
    if (error instanceof VerificationError) return response({ error: error.message }, error.status);
    const smtpError = error as { code?: string; responseCode?: number; command?: string };
    console.error("Client email verification failed", { code: smtpError.code, responseCode: smtpError.responseCode, command: smtpError.command });
    return response({ error: "Could not send the verification email. Check SMTP connectivity and credentials." }, 502);
  }
}
