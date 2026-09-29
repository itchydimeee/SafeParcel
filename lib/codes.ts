import { randomBytes, randomInt, scryptSync } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { EventType } from "./types";
import { adminDb } from "./firebase-admin";

/** Six-digit passcode shown to the owner. */
export function generatePasscode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function generateCodeId(): string {
  return randomBytes(8).toString("hex");
}

/** One-time secret shown to the owner when pairing, hashed before storing. */
export function generateDeviceKey(): string {
  return randomBytes(24).toString("hex");
}

/** How long a claim code stays valid for a box to provision itself. */
export const CLAIM_TTL_MS = 15 * 60 * 1000;

// Unambiguous alphabet (no 0/O/1/I) for codes typed on a phone or keypad.
const CLAIM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Short-lived code a physical box presents to claim its device key. */
export function generateClaimCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CLAIM_ALPHABET[randomInt(0, CLAIM_ALPHABET.length)];
  }
  return code;
}

export function hashDeviceKey(deviceKey: string): string {
  return scryptSync(deviceKey, "safedrop-device", 32).toString("hex");
}

export const VALID_HOURS = [1, 6, 24] as const;
export type ValidHours = (typeof VALID_HOURS)[number];

export function parseValidHours(value: unknown): ValidHours | null {
  const n = typeof value === "string" ? Number(value) : value;
  return (VALID_HOURS as readonly number[]).includes(n as number)
    ? (n as ValidHours)
    : null;
}

/** Append an event to a box's timeline. */
export async function addEvent(
  boxId: string,
  type: EventType,
  detail?: string
): Promise<void> {
  await adminDb()
    .collection("boxes")
    .doc(boxId)
    .collection("events")
    .add({
      type,
      ...(detail ? { detail } : {}),
      at: FieldValue.serverTimestamp(),
    });
}
