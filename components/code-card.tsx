"use client";

import { useState } from "react";
import { useNow } from "@/lib/hooks";
import type { CodeDoc } from "@/lib/types";

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function CodeCard({
  code,
  busy,
  onCancel,
}: {
  code: CodeDoc | null;
  busy: boolean;
  onCancel: () => void;
}) {
  const now = useNow(1000);
  const [copied, setCopied] = useState(false);

  if (!code || code.usedAt) return null;

  const expiresMs = code.expiresAt.toMillis();
  const remaining = expiresMs - now;
  const expired = remaining <= 0;
  const digits = code.code.split("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(code!.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (e.g. insecure context) — share below still works
    }
  }

  async function share() {
    const text = `SafeParcel passcode: ${code!.code} (one-time, expires in ${formatCountdown(remaining)})`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "SafeParcel passcode", text });
        return;
      } catch {
        // user dismissed the sheet — nothing more to do
        return;
      }
    }
    await copy();
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-400">
          Driver passcode
        </h2>
        <span
          className={`font-mono text-sm font-bold tabular-nums ${
            expired ? "text-red-400" : "text-slate-300"
          }`}
          aria-label="Time remaining"
        >
          {expired ? "Expired" : formatCountdown(remaining)}
        </span>
      </div>

      <div className="mb-5 flex justify-between gap-2" aria-label={`Passcode ${code.code}`}>
        {digits.map((d, i) => (
          <span
            key={i}
            className="flex h-14 flex-1 items-center justify-center rounded-xl bg-slate-800 font-mono text-2xl font-bold text-emerald-400"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="min-h-12 rounded-xl border border-slate-700 text-sm font-medium active:bg-slate-800"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={() => void share()}
          className="min-h-12 rounded-xl border border-slate-700 text-sm font-medium active:bg-slate-800"
        >
          Share
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-12 rounded-xl border border-red-500/30 text-sm font-medium text-red-400 active:bg-red-500/10 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
