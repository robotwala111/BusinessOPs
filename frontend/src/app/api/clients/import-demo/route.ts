import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { CLIENT_STATUSES } from "@/types/client";

export const runtime = "nodejs";
const columns = ["id", "company_name", "client_short_name", "contact_person", "email", "phone", "gst_number", "pan_number", "address", "city", "state", "country", "industry", "lead_source", "status", "notes", "account_owner", "payment_terms", "archived_at", "archived_by", "updated_by", "created_by", "created_at", "updated_at"];

export async function POST(request: NextRequest) {
  const client = await getPool().connect();
  try {
    const incoming = await request.json();
    if (!Array.isArray(incoming) || incoming.length > 1000) {
      return NextResponse.json({ error: "Expected up to 1,000 legacy client records." }, { status: 400 });
    }
    await client.query("begin");
    const existing = await client.query("select count(*)::int as count from public.clients");
    if (existing.rows[0].count > 0) {
      await client.query("rollback");
      return NextResponse.json({ imported: 0, skipped: true });
    }
    const allowed = columns.filter((column) => column !== "id" && column !== "created_at" && column !== "updated_at");
    for (const record of incoming) {
      if (!record || typeof record.company_name !== "string" || !record.company_name.trim() || !CLIENT_STATUSES.includes(record.status)) {
        throw new Error("Legacy client data contains an invalid record; no records were imported.");
      }
      const insertColumns = ["id", ...allowed, "created_at", "updated_at"];
      const values = [record.id, ...allowed.map((key) => record[key] ?? null), record.created_at, record.updated_at];
      const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
      await client.query(`insert into public.clients (${insertColumns.map((key) => `"${key}"`).join(", ")}) values (${placeholders}) on conflict (id) do nothing`, values);
    }
    await client.query("commit");
    return NextResponse.json({ imported: incoming.length });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error("POST /api/clients/import-demo failed", error);
    return NextResponse.json({ error: "Legacy clients could not be imported; the database transaction was rolled back." }, { status: 400 });
  } finally {
    client.release();
  }
}
