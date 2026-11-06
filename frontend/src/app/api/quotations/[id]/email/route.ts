import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_PDF_BYTES + 1024 * 1024;

type OutboundQuotation = {
  id: string;
  quotation_number: string;
  title: string;
  status: string;
  valid_until?: string | null;
  client?: { email?: string | null; company_name?: string | null } | null;
};

class RouteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" }
  });
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new RouteError(`SMTP is not configured: add ${name} to the server environment.`, 503);
  return value;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char] ?? char);
}

function explainSmtpFailure(error: unknown) {
  const smtpError = error as { code?: string; responseCode?: number; command?: string; message?: string };
  const code = smtpError.code || "unknown";
  if (code === "EAUTH" || smtpError.responseCode === 535) {
    return "SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD with your mail provider.";
  }
  if (code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "ECONNECTION" || code === "EHOSTUNREACH") {
    return "Could not connect to the SMTP server. Check SMTP_HOST, SMTP_PORT, and whether outbound SMTP is allowed.";
  }
  if (code === "ESOCKET" && /tls|ssl|certificate/i.test(smtpError.message || "")) {
    return "SMTP TLS negotiation failed. Match SMTP_SECURE to the provider port (587: false, 465: true).";
  }
  if (code === "EENVELOPE" || (smtpError.responseCode !== undefined && smtpError.responseCode >= 500)) {
    return "The SMTP provider rejected the sender or recipient. Check SMTP_FROM is verified and the client email is valid.";
  }
  return `SMTP delivery failed (${code}${smtpError.responseCode ? `, response ${smtpError.responseCode}` : ""}). Check the SMTP settings and the dev-server log.`;
}

async function readBoundedBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) throw new RouteError("The PDF attachment exceeds the 10 MB limit.", 413);
  if (!request.body) throw new RouteError("Request body is required.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new RouteError("The PDF attachment exceeds the 10 MB limit.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    const localDemoSend = process.env.NODE_ENV !== "production" && !supabaseUrl && !anonKey;
    let supabase: SupabaseClient<any> | null = null;
    let actorId: string | null = null;

    if (localDemoSend) {
      const origin = request.headers.get("origin");
      let originHost = "";
      try { originHost = new URL(origin || "").hostname; } catch { /* rejected below */ }
      if (!new Set(["localhost", "127.0.0.1", "::1"]).has(originHost)) {
        throw new RouteError("Demo email sending is only available from this computer during development.", 403);
      }
    } else {
      if (!token || !supabaseUrl || !anonKey) throw new RouteError("Sign in with a configured account before sending quotations.", 401);
      supabase = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
      });
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authData.user) throw new RouteError("Your session is invalid or expired. Sign in again.", 401);
      actorId = authData.user.id;
    }

    const contentType = request.headers.get("content-type");
    if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) throw new RouteError("Use multipart form data to attach the quotation PDF.", 400);
    const boundedBody = await readBoundedBody(request);
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": contentType },
      body: boundedBody
    }).formData();
    const attachment = form.get("pdf");
    const message = form.get("message");
    if (!(attachment instanceof Blob) || attachment.type !== "application/pdf") {
      throw new RouteError("A PDF quotation attachment is required.", 400);
    }
    if (attachment.size === 0 || attachment.size > MAX_PDF_BYTES) throw new RouteError("The PDF attachment must be between 1 byte and 10 MB.", 413);
    if (typeof message !== "string" || message.length > 5000) throw new RouteError("The email message must be 5,000 characters or fewer.", 400);
    const submittedFilename = form.get("filename");

    let quotation: OutboundQuotation | null = null;
    if (localDemoSend) {
      const serializedQuotation = form.get("quotation");
      if (typeof serializedQuotation !== "string" || serializedQuotation.length > 100_000) {
        throw new RouteError("Quotation details are required in local demo mode.", 400);
      }
      try { quotation = JSON.parse(serializedQuotation) as OutboundQuotation; } catch {
        throw new RouteError("Quotation details are invalid.", 400);
      }
      if (!quotation || quotation.id !== context.params.id || typeof quotation.quotation_number !== "string" || typeof quotation.title !== "string") {
        throw new RouteError("Quotation details are invalid.", 400);
      }
    } else {
      const { data, error: quotationError } = await supabase!
        .from("quotations")
        .select("id, quotation_number, title, status, valid_until, client:clients(email, company_name)")
        .eq("id", context.params.id)
        .maybeSingle();
      if (quotationError) throw new RouteError("Unable to verify the quotation and its client.", 500);
      if (!data) throw new RouteError("Quotation not found.", 404);
      const linkedClient = Array.isArray(data.client) ? data.client[0] : data.client;
      quotation = { ...data, client: linkedClient } as OutboundQuotation;
    }
    if (quotation.status !== "approved" && quotation.status !== "sent") {
      throw new RouteError("Only approved quotations can be emailed. Submit the quotation for review and approval first.", 409);
    }

    const client = quotation.client;
    const recipient = typeof client?.email === "string" ? client.email.trim() : "";
    const clientName = typeof client?.company_name === "string" ? client.company_name : "the client";
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      throw new RouteError("Add a valid email address to the client profile before sending this quotation.", 400);
    }

    const host = requiredEnv("SMTP_HOST");
    const port = Number(requiredEnv("SMTP_PORT"));
    const user = requiredEnv("SMTP_USER");
    const pass = requiredEnv("SMTP_PASSWORD");
    const from = requiredEnv("SMTP_FROM");
    const fromName = process.env.SMTP_FROM_NAME?.trim() || "Business Operations";
    const replyTo = process.env.SMTP_REPLY_TO?.trim();
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RouteError("SMTP_PORT must be a valid TCP port number.", 503);
    const secure = process.env.SMTP_SECURE?.trim().toLowerCase() === "true";

    const safeMessage = message.trim();
    const pdfBuffer = Buffer.from(await attachment.arrayBuffer());
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS: !secure,
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000
    });
    const subject = `Quotation ${quotation.quotation_number} | ${quotation.title}`.replace(/[\r\n]+/g, " ").slice(0, 250);
    const plainMessage = safeMessage || `Please find our quotation ${quotation.quotation_number} attached for your review.`;
    const validUntil = quotation.valid_until ? `This quotation is valid until ${quotation.valid_until}.` : "Please refer to the attached quotation for validity details.";

    try {
      await transporter.sendMail({
        from: { name: fromName, address: from },
        ...(replyTo ? { replyTo } : {}),
        to: recipient,
        subject,
        text: `Hello ${clientName},\n\n${plainMessage}\n\n${validUntil}\n\nRegards,\n${fromName}`,
        html: `<p>Hello ${escapeHtml(clientName)},</p><p>${escapeHtml(plainMessage).replace(/\r?\n/g, "<br>")}</p><p>${escapeHtml(validUntil)}</p><p>Regards,<br>${escapeHtml(fromName)}</p>`,
        attachments: [{ filename: (typeof submittedFilename === "string" ? submittedFilename : `${quotation.quotation_number}.pdf`).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "quotation.pdf", content: pdfBuffer, contentType: "application/pdf" }]
      });
    } catch (error) {
      const smtpError = error as { code?: string; responseCode?: number; command?: string };
      console.error("Quotation SMTP delivery failed", {
        code: smtpError.code,
        responseCode: smtpError.responseCode,
        command: smtpError.command
      });
      throw new RouteError(explainSmtpFailure(error), 502);
    }

    let trackingWarning: string | undefined;
    let updated = false;
    if (supabase && actorId) {
      const sentAt = new Date().toISOString();
      const { data: updatedQuotation, error: updateError } = await supabase.from("quotations")
        .update({ status: "sent", sent_at: sentAt, updated_by: actorId, updated_at: sentAt })
        .eq("id", context.params.id)
        .eq("status", quotation.status)
        .select("id")
        .maybeSingle();
      updated = Boolean(updatedQuotation);
      if (updateError || !updatedQuotation) {
        trackingWarning = "The email was accepted by the mail server, but the quotation status could not be updated. Refresh the quotation and check its status before resending.";
      } else {
        const { error: historyError } = await supabase.from("entity_history").insert({
          entity_type: "quotation",
          entity_id: context.params.id,
          event_type: quotation.status === "approved" ? "quotation_emailed" : "quotation_resent",
          previous_value: { status: quotation.status },
          new_value: { status: "sent", recipient },
          description: `Quotation ${quotation.quotation_number} emailed to ${recipient}`,
          actor_id: actorId,
          metadata: { recipient, subject }
        });
        if (historyError) trackingWarning = "The email was accepted and quotation marked as sent, but the activity history could not be recorded.";
      }
    }

    return json({ success: true, recipient, status: updated ? "sent" : quotation.status, localDemoSend, trackingWarning });
  } catch (error) {
    if (error instanceof RouteError) return json({ error: error.message }, error.status);
    console.error("POST /api/quotations/[id]/email failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "The email could not be sent. Check SMTP connectivity and credentials, then try again." }, 502);
  }
}
