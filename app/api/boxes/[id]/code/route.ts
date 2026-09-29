import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getOwnedBox, verifyOwnerUid } from "@/lib/auth";
import {
  addEvent,
  generateCodeId,
  generatePasscode,
  parseValidHours,
} from "@/lib/codes";
import { adminDb } from "@/lib/firebase-admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteContext) {
  const uid = await verifyOwnerUid(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const box = await getOwnedBox(uid, id);
  if (!box) {
    return NextResponse.json({ error: "box not found" }, { status: 404 });
  }

  let body: { validHours?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const validHours = parseValidHours(body?.validHours);
  if (!validHours) {
    return NextResponse.json({ error: "invalid validHours" }, { status: 400 });
  }

  const boxRef = adminDb().collection("boxes").doc(id);
  await boxRef.collection("private").doc("code").set({
    codeId: generateCodeId(),
    code: generatePasscode(),
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + validHours * 60 * 60 * 1000),
    usedAt: null,
    syncedAt: null,
  });
  await boxRef.update({ codeStatus: "active", wrongCount: 0 });
  await addEvent(id, "code_generated", `Valid ${validHours}h`);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const uid = await verifyOwnerUid(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const box = await getOwnedBox(uid, id);
  if (!box) {
    return NextResponse.json({ error: "box not found" }, { status: 404 });
  }

  await adminDb().collection("boxes").doc(id).collection("private").doc("code").delete();
  await adminDb().collection("boxes").doc(id).update({ codeStatus: "none" });

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
