"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, type User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from "@/components/auth-provider";
import { useBox, useUserDoc } from "@/lib/hooks";
import { auth, db } from "@/lib/firebase-client";
import { VALID_HOURS } from "@/lib/codes-client";

async function authedFetch(
  user: User,
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

function PairingResult({
  boxId,
  deviceKey,
  claimCode,
  onDone,
}: {
  boxId: string;
  deviceKey: string;
  claimCode: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState("");

  async function copy(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
      <h3 className="font-semibold text-emerald-400">Box paired</h3>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void copy(boxId, "boxId")}
          className="block w-full rounded-xl bg-slate-800 px-4 py-3 text-left"
        >
          <span className="text-xs text-slate-500">
            Box ID {copied === "boxId" ? "· copied" : "· tap to copy"}
          </span>
          <span className="block break-all font-mono text-sm">{boxId}</span>
        </button>
        <button
          type="button"
          onClick={() => void copy(deviceKey, "key")}
          className="block w-full rounded-xl bg-slate-800 px-4 py-3 text-left"
        >
          <span className="text-xs text-slate-500">
            Device key {copied === "key" ? "· copied" : "· tap to copy"}
          </span>
          <span className="block break-all font-mono text-sm">{deviceKey}</span>
        </button>
        <button
          type="button"
          onClick={() => void copy(claimCode, "claim")}
          className="block w-full rounded-xl bg-slate-800 px-4 py-3 text-left"
        >
          <span className="text-xs text-slate-500">
            Claim code · expires in 15 min{" "}
            {copied === "claim" ? "· copied" : "· tap to copy"}
          </span>
          <span className="block font-mono text-sm tracking-widest">
            {claimCode}
          </span>
        </button>
      </div>

      <div className="space-y-1 text-xs text-slate-400">
        <p>
          <span className="font-semibold text-slate-300">
            Prototype (hard-coded):
          </span>{" "}
          paste the Box ID and device key into{" "}
          <code className="text-emerald-300">secrets.h</code> and flash the
          sketch.
        </p>
        <p>
          <span className="font-semibold text-slate-300">
            Production (dynamic):
          </span>{" "}
          power the box while holding its <code className="text-emerald-300">*</code> key for 5 s
          to open setup mode, join its{" "}
          <code className="text-emerald-300">SafeDrop-Setup</code>{" "}
          Wi-Fi, and enter this claim code. The box pairs itself — no
          reflashing.
        </p>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="min-h-12 w-full rounded-xl bg-emerald-500 font-semibold text-slate-950 active:bg-emerald-400"
      >
        Done
      </button>
    </div>
  );
}

function BoxRow({ boxId, user }: { boxId: string; user: User }) {
  const { box } = useBox(boxId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await authedFetch(user, `/api/boxes/${boxId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(boxId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      {editing ? (
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Box name"
            maxLength={60}
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 text-base outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !name.trim()}
            className="min-h-12 rounded-xl bg-emerald-500 px-4 font-semibold text-slate-950 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{box?.name ?? "Box"}</p>
            <button
              type="button"
              onClick={() => void copyId()}
              className="mt-0.5 font-mono text-xs text-slate-500"
            >
              {boxId.slice(0, 10)}… {copied ? "copied" : "tap to copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setName(box?.name ?? "");
              setEditing(true);
            }}
            className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm font-medium active:bg-slate-800"
          >
            Rename
          </button>
        </div>
      )}
    </li>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { userDoc } = useUserDoc(user?.uid ?? null);
  const boxIds = userDoc?.boxIds ?? [];

  const [newName, setNewName] = useState("");
  const [pairing, setPairing] = useState<{
    boxId: string;
    deviceKey: string;
    claimCode: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function pairBox() {
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(user!, "/api/boxes", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() || "My SafeParcel Box" }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.deviceKey) {
        throw new Error(body?.error ?? "Pairing failed");
      }
      setPairing({
        boxId: body.boxId,
        deviceKey: body.deviceKey,
        claimCode: body.claimCode,
      });
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pairing failed");
    } finally {
      setBusy(false);
    }
  }

  async function setDefaultValidity(h: number) {
    await setDoc(
      doc(db, "users", user!.uid),
      { defaultValidity: h },
      { merge: true }
    );
  }

  async function signOutUser() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-slate-400">{user.email}</p>
      </header>

      {error && (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-400">Your boxes</h2>
        {boxIds.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
            No boxes paired yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {boxIds.map((id) => (
              <BoxRow key={id} boxId={id} user={user} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-400">Pair a new box</h2>
        {pairing ? (
          <PairingResult
            boxId={pairing.boxId}
            deviceKey={pairing.deviceKey}
            claimCode={pairing.claimCode}
            onDone={() => setPairing(null)}
          />
        ) : (
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Box name (optional)"
              maxLength={60}
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 text-base outline-none placeholder:text-slate-500 focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => void pairBox()}
              disabled={busy}
              className="min-h-12 rounded-xl bg-emerald-500 px-5 font-semibold text-slate-950 active:bg-emerald-400 disabled:opacity-50"
            >
              Pair
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-400">
          Default code validity
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {VALID_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => void setDefaultValidity(h)}
              className={`min-h-12 rounded-xl text-sm font-semibold ${
                (userDoc?.defaultValidity ?? 24) === h
                  ? "bg-emerald-500 text-slate-950"
                  : "border border-slate-700 text-slate-300 active:bg-slate-800"
              }`}
            >
              {h} h
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={() => void signOutUser()}
        className="min-h-12 w-full rounded-xl border border-red-500/30 text-sm font-semibold text-red-400 active:bg-red-500/10"
      >
        Sign out
      </button>
    </div>
  );
}
