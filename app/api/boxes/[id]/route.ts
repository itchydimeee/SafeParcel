import { NextResponse } from "next/server";
import { getOwnedBox, verifyOwnerUid } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const uid = await verifyOwnerUid(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const box = await getOwnedBox(uid, id);
  if (!box) {
    return NextResponse.json({ error: "box not found" }, { status: 404 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 60) {
    return NextResponse.json(
      { error: "name must be 1-60 characters" },
      { status: 400 }
    );
  }

  await adminDb().collection("boxes").doc(id).update({ name });
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
