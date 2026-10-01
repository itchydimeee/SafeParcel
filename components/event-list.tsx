"use client";

import { useNow } from "@/lib/hooks";
import type { EventDoc, EventType } from "@/lib/types";

const EVENT_META: Record<
  EventType,
  { label: string; dot: string }
> = {
  code_generated: { label: "Code generated", dot: "bg-sky-400" },
  code_synced: { label: "Code reached the box", dot: "bg-sky-400" },
  code_ok: { label: "Correct code entered", dot: "bg-emerald-400" },
  code_wrong: { label: "Wrong code attempt", dot: "bg-amber-400" },
  lockout: { label: "Box locked out (3 wrong tries)", dot: "bg-red-400" },
  opened: { label: "Box unlocked", dot: "bg-emerald-400" },
  closed: { label: "Box locked", dot: "bg-slate-400" },
  code_expired: { label: "Code expired", dot: "bg-amber-400" },
};

function timeAgo(ms: number, now: number): string {
  const diff = Math.max(0, now - ms);
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function EventList({
  events,
}: {
  events: (EventDoc & { id: string })[];
}) {
  const now = useNow(5000);

  if (events.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-800 py-10 text-center text-sm text-slate-500">
        No activity yet. Events will appear here as your box reports in.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900">
      {events.map((event) => {
        const meta = EVENT_META[event.type] ?? {
          label: event.type,
          dot: "bg-slate-500",
        };
        const atMs = event.at?.toMillis();
        return (
          <li key={event.id} className="flex items-center gap-3 px-4 py-3.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
            <span className="flex-1 text-sm">{meta.label}</span>
            <span className="text-xs tabular-nums text-slate-500">
              {atMs ? timeAgo(atMs, now) : "…"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
