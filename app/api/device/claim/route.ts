import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { hashDeviceKey } from "@/lib/codes";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";

const CLAIM_LIMIT = 10;
const WINDOW_MS = 60_000;

/**
 * Unauthenticated provisioning endpoint (the only device route without an
 * `x-device-key` header, since the device doesn't have its key yet).
 * The box presents the claim code shown by the app at pairing time and
 * receives its boxId + device key. Rate limited per IP.
 */
export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`claim:${ip}`, CLAIM_LIMIT, WINDOW_MS)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  let body: { claimCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const claimCode = (body?.claimCode ?? "").trim().toUpperCase();
  if (!claimCode) {
    return NextResponse.json(
      { error: "claimCode is required" },
      { status: 400 }
    );
  }

  const snap = await adminDb()
    .collection("boxes")
    .where("claimCodeHash", "==", hashDeviceKey(claimCode))
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json(
      { error: "Invalid claim code" },
      { status: 404 }
    );
  }

  const doc = snap.docs[0];
  const box = doc.data();

  if (!box.pendingDeviceKey) {
    return NextResponse.json(
      { error: "This box was already claimed" },
      { status: 410 }
    );
  }

  if (!box.claimExpiresAt || box.claimExpiresAt.toMillis() < Date.now()) {
    // Claim window over: drop the pending key so it can't leak later.
    await doc.ref.update({
      claimCodeHash: FieldValue.delete(),
      pendingDeviceKey: FieldValue.delete(),
      claimExpiresAt: FieldValue.delete(),
    });
    return NextResponse.json(
      { error: "Claim code expired — pair the box again" },
      { status: 410 }
    );
  }

  // Idempotent within the window: a retry (e.g. lost response) still works.
  return NextResponse.json({
    boxId: doc.id,
    deviceKey: box.pendingDeviceKey as string,
  });
}

export const dynamic = "force-dynamic";
