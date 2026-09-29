import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { verifyDevice } from "@/lib/auth";
import { addEvent } from "@/lib/codes";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import type { CodeDoc } from "@/lib/types";

const POLL_LIMIT = 40;
const WINDOW_MS = 60_000;

export async function GET(req: Request) {
  const boxId = new URL(req.url).searchParams.get("boxId");
  if (!boxId) {
    return NextResponse.json({ error: "boxId is required" }, { status: 400 });
  }
  if (!rateLimit(`sync:${boxId}`, POLL_LIMIT, WINDOW_MS)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const device = await verifyDevice(req, boxId);
  if (!device) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = adminDb();
  const boxRef = db.collection("boxes").doc(boxId);
  await boxRef.update({ lastSeen: FieldValue.serverTimestamp() });

  // Lazy cleanup: drop expired claim material whenever the box checks in.
  if (
    device.box.claimExpiresAt &&
    device.box.claimExpiresAt.toMillis() < Date.now()
  ) {
    await boxRef.update({
      claimCodeHash: FieldValue.delete(),
      pendingDeviceKey: FieldValue.delete(),
      claimExpiresAt: FieldValue.delete(),
    });
  }

  const codeSnap = await boxRef.collection("private").doc("code").get();
  if (!codeSnap.exists) {
    return NextResponse.json({ none: true });
  }

  const code = codeSnap.data() as CodeDoc;
  if (code.usedAt) {
    return NextResponse.json({ none: true });
  }

  const now = Date.now();
  const expiresAtMs = code.expiresAt.toMillis();
  if (expiresAtMs <= now) {
    await boxRef.update({ codeStatus: "expired" });
    await addEvent(boxId, "code_expired");
    return NextResponse.json({ none: true });
  }

  if (!code.syncedAt) {
    await codeSnap.ref.update({
      syncedAt: FieldValue.serverTimestamp(),
    });
    await addEvent(boxId, "code_synced");
  }

  return NextResponse.json({
    codeId: code.codeId,
    code: code.code,
    ttlSeconds: Math.max(0, Math.ceil((expiresAtMs - now) / 1000)),
  });
}

export const dynamic = "force-dynamic";
