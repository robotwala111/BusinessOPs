import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";
const editableColumns = ["company_name", "client_short_name", "contact_person", "email", "phone", "gst_number", "pan_number", "address", "city", "state", "country", "industry", "lead_source", "status", "notes", "account_owner", "payment_terms", "updated_by", "archived_at", "archived_by"];

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
  try {
    const { rows } = await getPool().query("select * from public.clients where id = $1", [context.params.id]);
    if (!rows[0]) return NextResponse.json({ error: "Client not found." }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("GET /api/clients/:id failed", error);
    return NextResponse.json({ error: "Unable to load client from local PostgreSQL." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const columns = Object.keys(body).filter((key) => editableColumns.includes(key));
    if (!columns.length) return NextResponse.json({ error: "No editable client fields provided." }, { status: 400 });
    const values = columns.map((column) => {
      const value = body[column];
      return typeof value === "string" && value.trim() === "" ? null : value ?? null;
    });
    const sets = columns.map((column, index) => `"${column}" = $${index + 1}`);
    values.push(context.params.id);
    const { rows } = await getPool().query(`update public.clients set ${sets.join(", ")}, updated_at = now() where id = $${values.length} returning *`, values);
    if (!rows[0]) return NextResponse.json({ error: "Client not found." }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("PATCH /api/clients/:id failed", error);
    return NextResponse.json({ error: "Unable to update client in local PostgreSQL." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  try {
    const { rowCount } = await getPool().query("delete from public.clients where id = $1", [context.params.id]);
    if (!rowCount) return NextResponse.json({ error: "Client not found." }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/clients/:id failed", error);
    return NextResponse.json({ error: "Unable to delete client from local PostgreSQL." }, { status: 500 });
  }
}
