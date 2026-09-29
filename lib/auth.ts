import type { BoxDoc } from "./types";
import { adminAuth, adminDb } from "./firebase-admin";
import { hashDeviceKey } from "./codes";

export { hashDeviceKey };

/** Verify a Firebase ID token sent as `Authorization: Bearer <token>`. */
export async function verifyOwnerUid(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) return null;
  try {
    const decoded = await adminAuth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}

export interface DeviceContext {
  uid: string;
  boxId: string;
  box: BoxDoc & { id: string };
}

/**
 * Verify the `x-device-key` header for a box. Returns null when the key is
 * missing, the box doesn't exist, or the key doesn't match the stored hash.
 */
export async function verifyDevice(
  req: Request,
  boxId: string
): Promise<DeviceContext | null> {
  const deviceKey = req.headers.get("x-device-key");
  if (!deviceKey) return null;

  const snap = await adminDb().collection("boxes").doc(boxId).get();
  if (!snap.exists) return null;

  const box = snap.data() as Omit<BoxDoc, "id">;
  if (!box.deviceKeyHash || box.deviceKeyHash !== hashDeviceKey(deviceKey)) {
    return null;
  }

  return { uid: box.ownerUid, boxId, box: { ...box, id: snap.id } };
}

/** Load a box and confirm the given uid owns it. */
export async function getOwnedBox(
  uid: string,
  boxId: string
): Promise<DeviceContext["box"] | null> {
  const snap = await adminDb().collection("boxes").doc(boxId).get();
  if (!snap.exists) return null;

  const box = snap.data() as Omit<BoxDoc, "id">;
  if (box.ownerUid !== uid) return null;

  return { ...box, id: snap.id };
}
