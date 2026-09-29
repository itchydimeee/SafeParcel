import { NextResponse } from "next/server";
import { verifyDevice } from "@/lib/auth";
import { addEvent } from "@/lib/codes";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";

const POST_LIMIT = 30;
const WINDOW_MS = 60_000;

export async function POST(req: Request) {
  let body: { boxId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const boxId = body?.boxId;
  if (!boxId) {
    return NextResponse.json({ error: "boxId is required" }, { status: 400 });
  }
  if (!rateLimit(`closed:${boxId}`, POST_LIMIT, WINDOW_MS)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const device = await verifyDevice(req, boxId);
  if (!device) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await adminDb().collection("boxes").doc(boxId).update({ status: "locked" });
  await addEvent(boxId, "closed");

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
