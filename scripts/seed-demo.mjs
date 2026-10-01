/**
 * Seeds the demo presentation data:
 *   - mock owner account  demo@safeparcle.app / demo1234
 *   - pre-paired box      "Demo SafeParcel Box" (demo-box-01)
 *   - active passcode     246810 (valid 24 h)
 *   - a believable event history for the Activity page
 *
 * Run: npm run seed   (idempotent — re-running resets the demo state)
 */

import { randomBytes, scryptSync } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

const DEMO_EMAIL = "demo@safeparcel.app";
const DEMO_PASSWORD = "demo1234";
const DEMO_BOX_ID = "demo-box-01";
const DEMO_DEVICE_KEY = "safedrop-demo-key";
const DEMO_CODE = "246810";

// Must match lib/codes.ts hashDeviceKey().
const DEVICE_KEY_SALT = "safedrop-device";

function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing Firebase admin credentials — expected FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env"
    );
    process.exit(1);
  }
  return (
    getApps()[0] ??
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  );
}

async function ensureAuthUser(auth) {
  try {
    const user = await auth.getUserByEmail(DEMO_EMAIL);
    console.log(`Auth user exists: ${DEMO_EMAIL} (${user.uid})`);
    return user;
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    const user = await auth.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      displayName: "Demo Owner",
      emailVerified: true,
    });
    console.log(`Created auth user: ${DEMO_EMAIL} (${user.uid})`);
    return user;
  }
}

async function main() {
  const app = initAdmin();
  const auth = getAuth(app);
  const db = getFirestore(app);

  const user = await ensureAuthUser(auth);

  await db
    .collection("users")
    .doc(user.uid)
    .set(
      {
        name: "Demo Owner",
        email: DEMO_EMAIL,
        boxIds: FieldValue.arrayUnion(DEMO_BOX_ID),
        defaultValidity: 24,
      },
      { merge: true }
    );
  console.log(`users/${user.uid} linked to box ${DEMO_BOX_ID}`);

  const now = Date.now();
  const boxRef = db.collection("boxes").doc(DEMO_BOX_ID);
  const existing = await boxRef.get();
  await boxRef.set({
    ownerUid: user.uid,
    name: "Demo SafeParcel Box",
    status: "locked",
    codeStatus: "active",
    deviceKeyHash: scryptSync(DEMO_DEVICE_KEY, DEVICE_KEY_SALT, 32).toString("hex"),
    wrongCount: 0,
    lastSeen: null,
    lockoutUntil: null,
    claimCodeHash: null,
    claimExpiresAt: null,
    pendingDeviceKey: null,
    createdAt:
      existing.exists && existing.data()?.createdAt
        ? existing.data().createdAt
        : FieldValue.serverTimestamp(),
  });
  console.log(`boxes/${DEMO_BOX_ID} reset (locked, pre-paired, no claim pending)`);

  await boxRef.collection("private").doc("code").set({
    codeId: randomBytes(8).toString("hex"),
    code: DEMO_CODE,
    createdAt: Timestamp.fromMillis(now - 5 * 60 * 1000),
    expiresAt: Timestamp.fromMillis(now + 24 * 60 * 60 * 1000),
    usedAt: null,
    syncedAt: null,
  });
  console.log(`Active passcode ${DEMO_CODE} seeded (expires in 24 h)`);

  const oldEvents = await boxRef.collection("events").listDocuments();
  const batch = db.batch();
  for (const ref of oldEvents) batch.delete(ref);
  await batch.commit();

  const DAY = 24 * 60 * 60 * 1000;
  const yesterday = now - DAY;
  const history = [
    { type: "code_generated", detail: "Valid 24h", at: yesterday },
    { type: "code_synced", at: yesterday + 2 * 60 * 1000 },
    { type: "code_ok", at: yesterday + 9 * 60 * 1000 },
    { type: "opened", at: yesterday + 9 * 60 * 1000 + 5 * 1000 },
    { type: "closed", at: yesterday + 14 * 60 * 1000 },
    { type: "code_generated", detail: "Valid 24h", at: now - 5 * 60 * 1000 },
  ];
  for (const e of history) {
    await boxRef
      .collection("events")
      .add({
        type: e.type,
        ...(e.detail ? { detail: e.detail } : {}),
        at: Timestamp.fromMillis(e.at),
      });
  }
  console.log(`Seeded ${history.length} events (past delivery + today's active code)`);

  const line = "─".repeat(54);
  console.log(`
${line}
  SafeParcel demo data is ready
${line}
  Login        /login
  Email        ${DEMO_EMAIL}
  Password     ${DEMO_PASSWORD}

  Box ID       ${DEMO_BOX_ID}
  Device key   ${DEMO_DEVICE_KEY}
  Passcode     ${DEMO_CODE}  (active, expires in 24 h)

  Presentation flow
    1. Sign in at /login with the email and password above.
    2. Dashboard shows "Demo SafeParcel Box" with passcode ${DEMO_CODE}.
    3. Open /simulator and tap "Use demo box" (or paste the Box ID
       and device key via Manual setup).
    4. Type ${DEMO_CODE} on the keypad and press # to open;
       after closing the box, press # again to lock it.
    5. Dashboard > Generate code issues a fresh one-time passcode.
${line}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
