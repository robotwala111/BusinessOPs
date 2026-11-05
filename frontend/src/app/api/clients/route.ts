import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { CLIENT_STATUSES } from "@/types/client";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { rows } = await getPool().query("select * from public.clients order by created_at desc");
    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/clients failed", error);
    return NextResponse.json({ error: "Unable to load clients from local PostgreSQL." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const columns = ["company_name", "client_short_name", "contact_person", "email", "phone", "gst_number", "pan_number", "address", "city", "state", "country", "industry", "lead_source", "status", "notes", "account_owner", "payment_terms", "created_by"];
    if (typeof body.company_name !== "string" || !body.company_name.trim()) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }
    if (!CLIENT_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid client status." }, { status: 400 });
    }
    const values = columns.map((column) => {
      const value = body[column];
      return typeof value === "string" && value.trim() === "" ? null : value ?? null;
    });
    const params = columns.map((_, index) => `$${index + 1}`).join(", ");
    const names = columns.map((column) => `"${column}"`).join(", ");
    const { rows } = await getPool().query(
      `insert into public.clients (${names}) values (${params}) returning *`,
      values,
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error("POST /api/clients failed", error);
    return NextResponse.json({ error: "Unable to save client to local PostgreSQL." }, { status: 500 });
  }
}
