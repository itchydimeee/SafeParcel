export type BoxStatus = "locked" | "open" | "lockout";
export type CodeStatus = "none" | "active" | "used" | "expired";

export type EventType =
  | "code_generated"
  | "code_synced"
  | "code_ok"
  | "code_wrong"
  | "lockout"
  | "opened"
  | "closed"
  | "code_expired";

export interface UserDoc {
  name?: string;
  email?: string;
  boxIds?: string[];
  defaultValidity?: number;
}

export interface BoxDoc {
  ownerUid: string;
  name: string;
  status: BoxStatus;
  codeStatus: CodeStatus;
  lastSeen?: { toMillis(): number } | null;
  lockoutUntil?: { toMillis(): number } | null;
  deviceKeyHash?: string;
  wrongCount?: number;
  createdAt?: { toMillis(): number };
  /** Present only while a claim code is pending. */
  claimCodeHash?: string | null;
  claimExpiresAt?: { toMillis(): number } | null;
  pendingDeviceKey?: string | null;
}

export interface CodeDoc {
  codeId: string;
  code: string;
  createdAt: { toMillis(): number };
  expiresAt: { toMillis(): number };
  usedAt?: { toMillis(): number } | null;
  syncedAt?: { toMillis(): number } | null;
}

export interface EventDoc {
  type: EventType;
  at?: { toMillis(): number };
  detail?: string;
}
