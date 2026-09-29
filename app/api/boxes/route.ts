import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { verifyOwnerUid } from "@/lib/auth";
import {
  CLAIM_TTL_MS,
  generateClaimCode,
  generateDeviceKey,
  hashDeviceKey,
} from "@/lib/codes";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  const uid = await verifyOwnerUid(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const name =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 60)
      : "My SafeParcel Box";

  const db = adminDb();
  const boxRef = db.collection("boxes").doc();
  const deviceKey = generateDeviceKey();
  const claimCode = generateClaimCode();
  const claimExpiresAt = Timestamp.fromMillis(Date.now() + CLAIM_TTL_MS);

  await boxRef.set({
    ownerUid: uid,
    name,
    status: "locked",
    codeStatus: "none",
    deviceKeyHash: hashDeviceKey(deviceKey),
    // Held only until the box claims its key (or the claim window ends).
    pendingDeviceKey: deviceKey,
    claimCodeHash: hashDeviceKey(claimCode),
    claimExpiresAt,
    wrongCount: 0,
    lastSeen: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  await db
    .collection("users")
    .doc(uid)
    .set(
      { boxIds: FieldValue.arrayUnion(boxRef.id) },
      { merge: true }
    );

  // The device key and claim code are only returned this one time.
  return NextResponse.json({
    boxId: boxRef.id,
    deviceKey,
    claimCode,
    claimExpiresAt: claimExpiresAt.toDate().toISOString(),
  });
}

export const dynamic = "force-dynamic";
