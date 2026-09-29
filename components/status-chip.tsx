"use client";

import { useNow } from "@/lib/hooks";
import type { BoxDoc, CodeDoc } from "@/lib/types";

export type CodeChipState =
  | "none"
  | "waiting"
  | "synced"
  | "used"
  | "expired";

const CHIP_STYLE: Record<CodeChipState, string> = {
  none: "bg-slate-700/40 text-slate-400",
  waiting: "bg-amber-500/15 text-amber-400",
  synced: "bg-sky-500/15 text-sky-400",
  used: "bg-emerald-500/15 text-emerald-400",
  expired: "bg-red-500/15 text-red-400",
};

const CHIP_LABEL: Record<CodeChipState, string> = {
  none: "No active code",
  waiting: "Waiting for box",
  synced: "Synced to box",
  used: "Code used",
  expired: "Code expired",
};

export function codeChipState(
  box: BoxDoc | null,
  code: CodeDoc | null
): CodeChipState {
  if (!box || box.codeStatus === "none") return "none";
  if (box.codeStatus === "used" || code?.usedAt) return "used";
  if (box.codeStatus === "expired") return "expired";
  return code?.syncedAt ? "synced" : "waiting";
}

export function StatusChip({
  box,
  code,
}: {
  box: BoxDoc | null;
  code: CodeDoc | null;
}) {
  const state = codeChipState(box, code);
  const now = useNow(5000);
  const lastSeenMs = box?.lastSeen?.toMillis();
  const online = !!lastSeenMs && now - lastSeenMs < 15_000;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${CHIP_STYLE[state]}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            online ? "bg-emerald-400" : "bg-slate-500"
          }`}
        />
        {CHIP_LABEL[state]}
      </span>
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
          online
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-slate-700/40 text-slate-500"
        }`}
      >
        Box {online ? "online" : "offline"}
      </span>
    </div>
  );
}
