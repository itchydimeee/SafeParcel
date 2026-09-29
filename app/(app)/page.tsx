"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { CodeCard } from "@/components/code-card";
import { StatusChip } from "@/components/status-chip";
import { useBox, useCodeDoc, useUserDoc } from "@/lib/hooks";
import { VALID_HOURS } from "@/lib/codes-client";

async function authedFetch(
  user: { getIdToken: () => Promise<string> },
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await user.getIdToken();
  return fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { userDoc } = useUserDoc(user?.uid ?? null);
  const boxIds = userDoc?.boxIds ?? [];
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const boxId = selectedBoxId ?? boxIds[0] ?? null;

  const { box } = useBox(boxId);
  const { code } = useCodeDoc(boxId);

  const [validHours, setValidHours] = useState<number>(24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default validity comes from the user doc once it loads.
  useEffect(() => {
    if (userDoc?.defaultValidity) setValidHours(userDoc.defaultValidity);
  }, [userDoc?.defaultValidity]);

  async function generate() {
    if (!user || !boxId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(user, `/api/boxes/${boxId}/code`, {
        method: "POST",
        body: JSON.stringify({ validHours }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the code");
    } finally {
      setBusy(false);
    }
  }

  async function cancelCode() {
    if (!user || !boxId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(user, `/api/boxes/${boxId}/code`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not cancel the code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel the code");
    } finally {
      setBusy(false);
    }
  }

  if (boxIds.length === 0) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-9 w-9">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="M3.3 7 12 12l8.7-5" />
            <path d="M12 22V12" />
          </svg>
        </div>
        <h1 className="text-xl font-bold">No box paired yet</h1>
        <p className="mt-2 max-w-60 text-sm text-slate-400">
          Pair your SafeParcel box to start generating one-time delivery
          passcodes.
        </p>
        <Link
          href="/settings"
          className="mt-6 flex min-h-12 items-center rounded-xl bg-emerald-500 px-6 font-semibold text-slate-950 active:bg-emerald-400"
        >
          Pair a box
        </Link>
      </div>
    );
  }

  const hasActiveCode = !!code && !code.usedAt;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{box?.name ?? "Your box"}</h1>
            <p className="text-sm text-slate-400">
              Share the passcode with your delivery driver
            </p>
          </div>
        </div>

        {boxIds.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {boxIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedBoxId(id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  id === boxId
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-slate-800 text-slate-400 active:bg-slate-700"
                }`}
              >
                {id === boxId ? (box?.name ?? "Box") : "Box"}
              </button>
            ))}
          </div>
        )}

        <StatusChip box={box} code={code} />
      </header>

      {error && (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <CodeCard code={code} busy={busy} onCancel={() => void cancelCode()} />

      {!hasActiveCode && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-400">
            Generate a passcode
          </h2>
          <div className="mb-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Code validity">
            {VALID_HOURS.map((h) => (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={validHours === h}
                onClick={() => setValidHours(h)}
                className={`min-h-12 rounded-xl text-sm font-semibold ${
                  validHours === h
                    ? "bg-emerald-500 text-slate-950"
                    : "border border-slate-700 text-slate-300 active:bg-slate-800"
                }`}
              >
                {h} h
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy}
            className="min-h-14 w-full rounded-xl bg-emerald-500 text-base font-bold text-slate-950 transition active:bg-emerald-400 disabled:opacity-50"
          >
            Generate code
          </button>
        </section>
      )}

      <p className="text-center text-xs text-slate-500">
        No hardware yet? Test the full flow in the{" "}
        <Link href="/simulator" className="text-emerald-400 underline">
          simulator
        </Link>
        .
      </p>
    </div>
  );
}
