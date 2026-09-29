import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { verifyDevice } from "@/lib/auth";
import { addEvent } from "@/lib/codes";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import type { CodeDoc } from "@/lib/types";

const POST_LIMIT = 30;
const WINDOW_MS = 60_000;

export async function POST(req: Request) {
  let body: { boxId?: string; codeId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const boxId = body?.boxId;
  const codeId = body?.codeId;
  if (!boxId || !codeId) {
    return NextResponse.json(
      { error: "boxId and codeId are required" },
      { status: 400 }
    );
  }
  if (!rateLimit(`used:${boxId}`, POST_LIMIT, WINDOW_MS)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const device = await verifyDevice(req, boxId);
  if (!device) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = adminDb();
  const boxRef = db.collection("boxes").doc(boxId);
  const codeRef = boxRef.collection("private").doc("code");
  const codeSnap = await codeRef.get();

  if (codeSnap.exists) {
    const code = codeSnap.data() as CodeDoc;
    if (code.codeId === codeId && !code.usedAt) {
      // First report for this code: mark used exactly once.
      await codeRef.update({ usedAt: FieldValue.serverTimestamp() });
      await boxRef.update({
        status: "open",
        codeStatus: "used",
        wrongCount: 0,
      });
      await addEvent(boxId, "code_ok");
      await addEvent(boxId, "opened");
    }
  }

  // Idempotent: repeat calls are safe and always succeed.
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
