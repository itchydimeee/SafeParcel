"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { EventList } from "@/components/event-list";
import { useBox, useEvents, useUserDoc } from "@/lib/hooks";

export default function ActivityPage() {
  const { user } = useAuth();
  const { userDoc } = useUserDoc(user?.uid ?? null);
  const boxIds = userDoc?.boxIds ?? [];
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const boxId = selectedBoxId ?? boxIds[0] ?? null;

  const { box } = useBox(boxId);
  const { events, loading } = useEvents(boxId);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Activity</h1>
        <p className="text-sm text-slate-400">
          Live timeline for {box?.name ?? "your box"}
        </p>
      </header>

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

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
        </div>
      ) : (
        <EventList events={events} />
      )}
    </div>
  );
}
