import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { detectCopilotIntent, estimateAiCostUsd } from "@/lib/copilotTools";
import { getCopilotFacts } from "@/services/copilotData";
import { assertCopilotProviderConfigured, generateCopilotAnswer } from "@/services/copilotProvider";
import type { CopilotMessage, CopilotConversation, CopilotRecord, CopilotIntent } from "@/types/copilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class CopilotRouteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" }
  });
}

async function readBoundedBody(request: Request, maxBytes: number) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new CopilotRouteError("Request is too large.", 413);
  }
  if (!request.body) throw new CopilotRouteError("Request body is required.", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new CopilotRouteError("Request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function createAuthenticatedClient(request: Request): SupabaseClient {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!token || !url || !anonKey) {
    throw new CopilotRouteError("Sign in with a configured Supabase account to use Copilot.", 401);
  }

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
  return client;
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new CopilotRouteError("Copilot usage controls require the server-side Supabase service role key.", 503);
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

async function authenticate(request: Request) {
  const client = createAuthenticatedClient(request);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!token) throw new CopilotRouteError("Authentication is required.", 401);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new CopilotRouteError("Your session is invalid or expired. Sign in again.", 401);
  return { client, user: data.user };
}

function responseError(error: unknown) {
  if (error instanceof CopilotRouteError) {
    return jsonResponse({ error: error.message }, error.status);
  }
  if (error instanceof Error && error.message.startsWith("AI is not configured")) {
    return jsonResponse({ error: error.message }, 503);
  }
  if (error instanceof Error && error.message.includes("AI provider")) {
    return jsonResponse({ error: error.message }, 502);
  }
  console.error("Copilot request failed", error instanceof Error ? error.message : "Unknown error");
  return jsonResponse({ error: error instanceof Error ? error.message : "Unable to complete the Copilot request." }, 500);
}

function requiredCostRate(name: string) {
  const value = Number(process.env[name]);
  if (!process.env[name]?.trim() || !Number.isFinite(value) || value < 0) {
    throw new CopilotRouteError(`Configure ${name} on the server to enable AI cost tracking.`, 503);
  }
  return value;
}

function boundedSetting(name: string, defaultValue: number, max: number) {
  const value = Number(process.env[name] ?? defaultValue);
  if (!Number.isFinite(value) || value <= 0 || value > max) {
    throw new CopilotRouteError(`${name} must be greater than zero and no more than ${max}.`, 503);
  }
  return value;
}

async function reserveUsageBudget(serviceClient: SupabaseClient, userId: string, requestId: string) {
  const hourlyLimit = Number(process.env.AI_MAX_REQUESTS_PER_HOUR ?? 20);
  if (!Number.isInteger(hourlyLimit) || hourlyLimit < 1 || hourlyLimit > 20) {
    throw new CopilotRouteError("AI_MAX_REQUESTS_PER_HOUR must be an integer from 1 to 20.", 503);
  }
  const dailyBudget = Number(process.env.AI_DAILY_BUDGET_USD ?? "2");
  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0 || dailyBudget > 10) {
    throw new CopilotRouteError("AI_DAILY_BUDGET_USD must be greater than zero and no more than 10.", 503);
  }
  const reservedCost = boundedSetting("AI_MAX_REQUEST_COST_USD", 0.25, 0.5);
  const { data, error } = await serviceClient.rpc("reserve_copilot_ai_request", {
    p_user_id: userId,
    p_request_id: requestId,
    p_hourly_limit: hourlyLimit,
    p_daily_budget_usd: dailyBudget,
    p_reserved_cost_usd: reservedCost
  });
  if (error) {
    console.error("Copilot budget reservation failed", { code: error.code });
    throw new CopilotRouteError("Copilot usage controls are unavailable. Apply AI Copilot migration 023.", 503);
  }
  if (data !== true) throw new CopilotRouteError("Copilot request limit or daily AI budget reached.", 429);
  return reservedCost;
}

async function assertSecurityMigrationsApplied(serviceClient: SupabaseClient) {
  const { data, error } = await serviceClient.rpc("copilot_security_ready");
  if (error || data !== true) {
    console.error("Copilot security preflight failed", { code: error?.code });
    throw new CopilotRouteError("Copilot is locked until security migration 022 is applied and verified.", 503);
  }
}

async function listConversations(client: SupabaseClient) {
  const { data, error } = await client
    .from("copilot_conversations")
    .select("id,title,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("Copilot conversation list failed", { code: error.code });
    throw new CopilotRouteError("Unable to load Copilot history. Apply the AI Copilot database migration.", 503);
  }
  return (data ?? []) as CopilotConversation[];
}

export async function GET(request: Request) {
  try {
    const { client } = await authenticate(request);
    const conversationId = new URL(request.url).searchParams.get("conversationId");
    if (!conversationId) {
      return jsonResponse({ conversations: await listConversations(client) });
    }
    if (!uuidPattern.test(conversationId)) {
      throw new CopilotRouteError("Invalid conversation identifier.", 400);
    }
    const { data: conversation, error: conversationError } = await client
      .from("copilot_conversations")
      .select("id,title,updated_at")
      .eq("id", conversationId)
      .maybeSingle();
    if (conversationError) throw new CopilotRouteError("Unable to load this conversation.", 500);
    if (!conversation) throw new CopilotRouteError("Conversation not found.", 404);
    const { data: messages, error: messagesError } = await client
      .from("copilot_messages")
      .select("id,role,content,records,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (messagesError) throw new CopilotRouteError("Unable to load conversation messages.", 500);
    return jsonResponse({
      conversation: conversation as CopilotConversation,
      messages: (messages ?? []) as CopilotMessage[]
    });
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: Request) {
  let reservation: { client: SupabaseClient; userId: string; requestId: string } | null = null;
  try {
    if (process.env.AI_COPILOT_ENABLED !== "true") {
      throw new CopilotRouteError("Copilot is disabled until migrations 022-023 and server configuration are verified.", 503);
    }
    const rawBody = await readBoundedBody(request, 8192);
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new CopilotRouteError("Request body must be valid JSON.", 400);
    }
    if (!body || typeof body !== "object") throw new CopilotRouteError("Invalid request body.", 400);
    const input = body as { message?: unknown; conversationId?: unknown; language?: unknown };
    if (typeof input.message !== "string" || input.message.trim().length < 2 || input.message.trim().length > 2000) {
      throw new CopilotRouteError("Enter a question between 2 and 2,000 characters.", 400);
    }
    const message = input.message.trim();
    const intent: CopilotIntent = detectCopilotIntent(message) ?? "assistant_status";
    if (input.conversationId != null && (typeof input.conversationId !== "string" || !uuidPattern.test(input.conversationId))) {
      throw new CopilotRouteError("Invalid conversation identifier.", 400);
    }

    const { client, user } = await authenticate(request);
    assertCopilotProviderConfigured();
    const inputRate = requiredCostRate("AI_INPUT_COST_PER_MILLION_USD");
    const outputRate = requiredCostRate("AI_OUTPUT_COST_PER_MILLION_USD");
    const serviceClient = createServiceClient();
    await assertSecurityMigrationsApplied(serviceClient);
    const requestId = crypto.randomUUID();
    const reservedCost = await reserveUsageBudget(serviceClient, user.id, requestId);
    reservation = { client: serviceClient, userId: user.id, requestId };

    let conversation: CopilotConversation;
    if (input.conversationId) {
      const { data, error } = await client
        .from("copilot_conversations")
        .select("id,title,updated_at")
        .eq("id", input.conversationId)
        .maybeSingle();
      if (error) throw new CopilotRouteError("Unable to access this conversation.", 500);
      if (!data) throw new CopilotRouteError("Conversation not found.", 404);
      conversation = data as CopilotConversation;
    } else {
      const { data, error } = await client
        .from("copilot_conversations")
        .insert({ user_id: user.id, title: message.slice(0, 200) })
        .select("id,title,updated_at")
        .single();
      if (error || !data) {
        console.error("Copilot conversation create failed", { code: error?.code });
        throw new CopilotRouteError("Unable to start a Copilot conversation. Apply the AI Copilot database migration.", 503);
      }
      conversation = data as CopilotConversation;
    }

    const { data: priorMessages, error: historyError } = await client
      .from("copilot_messages")
      .select("role,content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(6);
    if (historyError) throw new CopilotRouteError("Unable to load conversation context.", 500);

    const { data: savedUserMessage, error: saveUserError } = await client
      .from("copilot_messages")
      .insert({ conversation_id: conversation.id, user_id: user.id, role: "user", content: message })
      .select("id,role,content,records,created_at")
      .single();
    if (saveUserError || !savedUserMessage) {
      console.error("Copilot question save failed", { code: saveUserError?.code });
      throw new CopilotRouteError("Unable to save this Copilot question.", 500);
    }

    const facts = intent === "assistant_status"
      ? { facts: {}, records: [] as CopilotRecord[] }
      : await getCopilotFacts(client, intent);
    const history = (intent === "assistant_status" ? [] : (priorMessages ?? []).reverse()).map((item) => ({
      role: item.role as "user" | "assistant",
      content: String(item.content).slice(0, 4000)
    }));
    const language = typeof input.language === "string" ? input.language : undefined;
    const result = await generateCopilotAnswer(message, facts.facts, history, language);
    const estimatedCost = estimateAiCostUsd(
      result.inputTokens,
      result.outputTokens,
      String(inputRate),
      String(outputRate)
    );
    if (estimatedCost == null) throw new CopilotRouteError("Unable to calculate AI usage cost.", 503);
    if (estimatedCost > reservedCost) {
      throw new CopilotRouteError("This request exceeded the configured per-request AI cost reservation.", 503);
    }

    const { error: usageError } = await serviceClient.rpc("record_copilot_ai_usage", {
      p_user_id: user.id,
      p_request_id: requestId,
      p_conversation_id: conversation.id,
      p_operation: intent,
      p_model: result.model,
      p_input_tokens: result.inputTokens,
      p_output_tokens: result.outputTokens,
      p_estimated_cost_usd: estimatedCost
    });
    if (usageError) {
      console.error("Copilot usage log failed", { code: usageError.code });
      throw new CopilotRouteError("The answer was generated but usage could not be recorded. Contact an administrator before retrying.", 503);
    }
    reservation = null;

    const records = facts.records.slice(0, 100) as CopilotRecord[];
    const { data: savedAssistantMessage, error: saveAssistantError } = await serviceClient
      .from("copilot_messages")
      .insert({
        conversation_id: conversation.id,
        user_id: user.id,
        role: "assistant",
        content: result.answer,
        records
      })
      .select("id,role,content,records,created_at")
      .single();
    if (saveAssistantError || !savedAssistantMessage) {
      console.error("Copilot answer history save failed", { code: saveAssistantError?.code });
      throw new CopilotRouteError("The answer was generated, but conversation history could not be saved.", 503);
    }

    const { error: conversationUpdateError } = await client.from("copilot_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id);
    if (conversationUpdateError) {
      console.error("Copilot conversation timestamp update failed", { code: conversationUpdateError.code });
    }
    return jsonResponse({
      conversation,
      userMessage: savedUserMessage as CopilotMessage,
      message: savedAssistantMessage as CopilotMessage,
      usage: {
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        estimated_cost_usd: estimatedCost
      }
    });
  } catch (error) {
    if (reservation) {
      const { error: releaseError } = await reservation.client.rpc("release_copilot_ai_request", {
        p_user_id: reservation.userId,
        p_request_id: reservation.requestId
      });
      if (releaseError) console.error("Copilot budget reservation release failed", { code: releaseError.code });
    }
    return responseError(error);
  }
}
