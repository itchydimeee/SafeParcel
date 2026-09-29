import { NextResponse } from "next/server";
import { getOwnedBox, verifyOwnerUid } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

type RouteContext = { params: Promise<{ id: string }> };

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
