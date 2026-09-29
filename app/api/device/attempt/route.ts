import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { verifyDevice } from "@/lib/auth";
import { addEvent } from "@/lib/codes";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";

const POST_LIMIT = 30;
const WINDOW_MS = 60_000;
const LOCKOUT_SECONDS = 30;
const MAX_WRONG = 3;

export async function POST(req: Request) {
  let body: { boxId?: string; result?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const boxId = body?.boxId;
  if (!boxId || body?.result !== "wrong") {
    return NextResponse.json(
      { error: "boxId and result: 'wrong' are required" },
      { status: 400 }
    );
  }
  if (!rateLimit(`attempt:${boxId}`, POST_LIMIT, WINDOW_MS)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const device = await verifyDevice(req, boxId);
  if (!device) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const boxRef = adminDb().collection("boxes").doc(boxId);
  const wrongCount = (device.box.wrongCount ?? 0) + 1;

  if (wrongCount >= MAX_WRONG) {
    await boxRef.update({
      wrongCount: 0,
      status: "lockout",
      lockoutUntil: Timestamp.fromMillis(
        Date.now() + LOCKOUT_SECONDS * 1000
      ),
    });
    await addEvent(boxId, "lockout");
    return NextResponse.json({ ok: true, lockedSeconds: LOCKOUT_SECONDS });
  }

  await boxRef.update({ wrongCount });
  await addEvent(boxId, "code_wrong");
  return NextResponse.json({ ok: true, lockedSeconds: 0 });
}

export const dynamic = "force-dynamic";
