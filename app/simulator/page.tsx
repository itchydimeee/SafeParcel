"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Phase = "idle" | "open" | "lockout";

interface ActiveCode {
  codeId: string;
  code: string;
  expiresAtMs: number;
}

interface MachineState {
  phase: Phase;
  activeCode: ActiveCode | null;
  entry: string;
  lastKeyAt: number;
  lockoutEndMs: number;
  eeprom: string[];
}

const LS_CONFIG = "safedrop-sim-config";
const LS_EEPROM = "safedrop-sim-eeprom";
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
// One-click demo connection — must match scripts/seed-demo.mjs.
const DEMO_BOX_ID = "demo-box-01";
const DEMO_DEVICE_KEY = "safedrop-demo-key";

function loadEeprom(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_EEPROM);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export default function SimulatorPage() {
  const [boxId, setBoxId] = useState("");
  const [deviceKey, setDeviceKey] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [connected, setConnected] = useState(false);

  const [lcd, setLcd] = useState<[string, string]>(["Booting...", ""]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [entry, setEntry] = useState("");
  const [activeCode, setActiveCode] = useState<ActiveCode | null>(null);
  const [greenOn, setGreenOn] = useState(false);
  const [redOn, setRedOn] = useState(false);
  const [locked, setLocked] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const eeprom = useRef<string[]>([]);
  const lastKeyAt = useRef(0);
  const lockoutEndMs = useRef(0);
  const pendingUsed = useRef<string | null>(null);
  const pendingClosed = useRef(false);
  const stateRef = useRef<MachineState>({
    phase: "idle",
    activeCode: null,
    entry: "",
    lastKeyAt: 0,
    lockoutEndMs: 0,
    eeprom: [],
  });

  // Mirror render state into a ref so async handlers always see the truth.
  useEffect(() => {
    stateRef.current = {
      phase,
      activeCode,
      entry,
      lastKeyAt: lastKeyAt.current,
      lockoutEndMs: lockoutEndMs.current,
      eeprom: eeprom.current,
    };
  });

  // Load persisted config + EEPROM ("device memory").
  useEffect(() => {
    eeprom.current = loadEeprom();
    try {
      const raw = localStorage.getItem(LS_CONFIG);
      if (raw) {
        const cfg = JSON.parse(raw) as { boxId: string; deviceKey: string };
        setBoxId(cfg.boxId);
        setDeviceKey(cfg.deviceKey);
        setConnected(true);
        setLcd(["Enter passcode", ""]);
      }
    } catch {
      // first visit — show the config form
    }
  }, []);

  function saveConfig() {
    if (!boxId.trim() || !deviceKey.trim()) return;
    localStorage.setItem(
      LS_CONFIG,
      JSON.stringify({ boxId: boxId.trim(), deviceKey: deviceKey.trim() })
    );
    setConnected(true);
    setLocked(true);
    setLcd(["Enter passcode", ""]);
  }

  /** One-click connect to the seeded demo box (any browser or device). */
  function connectDemo() {
    setBoxId(DEMO_BOX_ID);
    setDeviceKey(DEMO_DEVICE_KEY);
    localStorage.setItem(
      LS_CONFIG,
      JSON.stringify({ boxId: DEMO_BOX_ID, deviceKey: DEMO_DEVICE_KEY })
    );
    setConnected(true);
    setLocked(true);
    setLcd(["Enter passcode", ""]);
  }

  /** Production pairing path: exchange a claim code for box credentials. */
  async function claimConnect() {
    const code = claimCode.trim().toUpperCase();
    if (!code) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/device/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimCode: code }),
      });
      const data = (await res.json()) as {
        boxId?: string;
        deviceKey?: string;
        error?: string;
      };
      if (!res.ok || !data.boxId || !data.deviceKey) {
        setStatus(data.error ?? "Claim failed");
        return;
      }
      setBoxId(data.boxId);
      setDeviceKey(data.deviceKey);
      setClaimCode("");
      localStorage.setItem(
        LS_CONFIG,
        JSON.stringify({ boxId: data.boxId, deviceKey: data.deviceKey })
      );
      setConnected(true);
      setLocked(true);
      setLcd(["Box claimed!", "Enter passcode"]);
    } catch {
      setStatus("Claim failed — check connection");
    } finally {
      setClaiming(false);
    }
  }

  function forgetConfig() {
    localStorage.removeItem(LS_CONFIG);
    setConnected(false);
    setBoxId("");
    setDeviceKey("");
    setActiveCode(null);
    setPhase("idle");
    setGreenOn(false);
    setRedOn(false);
    setLocked(true);
    setLcd(["No box paired", "Enter config"]);
  }

  function addToEeprom(codeId: string) {
    eeprom.current = [...eeprom.current, codeId];
    try {
      localStorage.setItem(LS_EEPROM, JSON.stringify(eeprom.current));
    } catch {
      // storage full — memory only
    }
  }

  async function postEvent(path: string, body: object) {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-key": deviceKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed`);
    return res.json();
  }

  function flashRed() {
    setRedOn(true);
    setTimeout(() => {
      if (stateRef.current.phase !== "lockout") setRedOn(false);
    }, 2000);
  }

  async function reportWrong() {
    try {
      const data = (await postEvent("/api/device/attempt", {
        boxId,
        result: "wrong",
      })) as { lockedSeconds?: number };
      if (data.lockedSeconds && data.lockedSeconds > 0) {
        lockoutEndMs.current = Date.now() + data.lockedSeconds * 1000;
        setPhase("lockout");
        setRedOn(true);
        setLcd(["Locked out", `${data.lockedSeconds}s remaining`]);
      }
    } catch {
      setStatus("Can't reach server — will retry");
    }
  }

  async function submit() {
    const s = stateRef.current;
    const typed = s.entry;
    setEntry("");
    setLcd(["Checking...", ""]);

    if (!s.activeCode) {
      flashRed();
      setLcd(["No active code", ""]);
      return;
    }

    if (typed === s.activeCode.code) {
      const usedCodeId = s.activeCode.codeId;
      setActiveCode(null);
      addToEeprom(usedCodeId);
      setPhase("open");
      setLocked(false);
      setGreenOn(true);
      setRedOn(false);
      setLcd(["Correct!", "Leave parcel, take"]);
      setTimeout(() => setLcd(["payment, press button", "when done"]), 1600);
      try {
        await postEvent("/api/device/used", { boxId, codeId: usedCodeId });
        pendingUsed.current = null;
      } catch {
        pendingUsed.current = usedCodeId;
        setStatus("Can't reach server — will retry");
      }
    } else {
      setLcd(["Incorrect!", ""]);
      flashRed();
      void reportWrong();
    }
  }

  function pressKey(k: string) {
    lastKeyAt.current = Date.now();
    const s = stateRef.current;

    if (s.phase === "lockout") {
      setLcd(["Locked out", ""]);
      return;
    }
    if (k === "*") {
      setEntry("");
      setLcd(["Enter passcode", ""]);
      return;
    }
    if (k === "#") {
      void submit();
      return;
    }
    if (s.entry.length >= 8) return;
    const next = s.entry + k;
    setEntry(next);
    setLcd(["Enter passcode", "*".repeat(next.length)]);
  }

  async function confirmLock() {
    if (stateRef.current.phase !== "open") return;
    setLocked(true);
    setGreenOn(false);
    setPhase("idle");
    setLcd(["Enter passcode", ""]);
    try {
      await postEvent("/api/device/closed", { boxId });
      pendingClosed.current = false;
    } catch {
      pendingClosed.current = true;
      setStatus("Can't reach server — will retry");
    }
  }

  function reboot() {
    setActiveCode(null);
    setEntry("");
    setPhase("idle");
    setGreenOn(false);
    setRedOn(false);
    setLocked(true);
    lastKeyAt.current = 0;
    setLcd(["Rebooting...", ""]);
    setTimeout(() => setLcd(["Enter passcode", ""]), 900);
  }

  async function poll() {
    try {
      // Flush queued events first, like the firmware does.
      if (pendingUsed.current) {
        await postEvent("/api/device/used", {
          boxId,
          codeId: pendingUsed.current,
        });
        pendingUsed.current = null;
      }
      if (pendingClosed.current) {
        await postEvent("/api/device/closed", { boxId });
        pendingClosed.current = false;
      }

      const res = await fetch(
        `/api/device/sync?boxId=${encodeURIComponent(boxId)}`,
        { headers: { "x-device-key": deviceKey }, cache: "no-store" }
      );
      if (res.status === 401) {
        setStatus("Device key rejected — check config");
        return;
      }
      const data = (await res.json()) as
        | { none: true }
        | { codeId: string; code: string; ttlSeconds: number };
      setStatus(null);

      if ("none" in data) {
        if (stateRef.current.activeCode) setLcd(["Code cleared", ""]);
        setActiveCode(null);
        return;
      }

      if (eeprom.current.includes(data.codeId)) {
        // Reboot protection: a used codeId is never trusted again.
        if (stateRef.current.activeCode) setActiveCode(null);
        return;
      }

      setActiveCode({
        codeId: data.codeId,
        code: data.code,
        expiresAtMs: Date.now() + data.ttlSeconds * 1000,
      });
    } catch {
      setStatus("Can't reach server — will retry");
    }
  }

  // Sync loop: poll every 3 s while idle, paused for 5 s after a keypress.
  useEffect(() => {
    if (!connected) return;
    void poll();
    const iv = setInterval(() => {
      const s = stateRef.current;
      if (s.phase !== "idle") return;
      if (Date.now() - s.lastKeyAt < 5000) return;
      void poll();
    }, 3000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, boxId, deviceKey]);

  // 1 s tick: expiry countdown + lockout countdown.
  useEffect(() => {
    if (!connected) return;
    const iv = setInterval(() => {
      const s = stateRef.current;

      if (s.phase === "lockout") {
        const remain = Math.ceil((s.lockoutEndMs - Date.now()) / 1000);
        if (remain <= 0) {
          setPhase("idle");
          setRedOn(false);
          setLcd(["Enter passcode", ""]);
        } else {
          setLcd(["Locked out", `${remain}s remaining`]);
        }
        return;
      }

      if (s.activeCode && s.activeCode.expiresAtMs <= Date.now()) {
        setActiveCode(null);
        setLcd(["Code expired", ""]);
      }
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const phaseLabel =
    phase === "open"
      ? "Unlocked — waiting for confirm"
      : phase === "lockout"
        ? "Locked out"
        : locked
          ? "Locked"
          : "Locked";

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Box simulator</h1>
          <p className="text-sm text-slate-400">
            Virtual SafeParcel using the device API
          </p>
        </div>
        <Link href="/" className="min-h-12 px-2 py-3 text-sm text-emerald-400">
          ← App
        </Link>
      </header>

      <section className="mb-5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-400">Connection</h2>
          {connected ? (
            <button
              type="button"
              onClick={forgetConfig}
              className="text-xs font-medium text-slate-500 underline"
            >
              Forget box
            </button>
          ) : null}
        </div>

        {connected ? (
          <div className="mt-3 space-y-1 text-sm">
            <p>
              <span className="text-slate-500">Box ID: </span>
              <span className="break-all font-mono">{boxId}</span>
            </p>
            {status ? (
              <p className="text-amber-400">{status}</p>
            ) : (
              <p className="text-emerald-400">Connected · polling /sync</p>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-500">
              Pair a box in the app&apos;s Settings screen. Then claim it with
              the claim code (like real hardware does), or paste the Box ID and
              device key directly.
            </p>

            <button
              type="button"
              onClick={connectDemo}
              className="min-h-12 w-full rounded-xl bg-emerald-500 font-semibold text-slate-950 active:bg-emerald-400"
            >
              Use demo box
            </button>

            <div className="rounded-xl border border-slate-700 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-400">
                Claim with code (production path)
              </p>
              <input
                value={claimCode}
                onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                placeholder="Claim code (e.g. K7M2XW4P)"
                maxLength={8}
                className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 font-mono text-sm uppercase outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => void claimConnect()}
                disabled={!claimCode.trim() || claiming}
                className="mt-2 min-h-12 w-full rounded-xl bg-emerald-500 font-semibold text-slate-950 disabled:opacity-50"
              >
                {claiming ? "Claiming..." : "Claim & connect"}
              </button>
            </div>

            <details className="rounded-xl border border-slate-700 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-400">
                Manual setup (prototype path)
              </summary>
              <div className="mt-2 space-y-2">
                <input
                  value={boxId}
                  onChange={(e) => setBoxId(e.target.value)}
                  placeholder="Box ID"
                  className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 font-mono text-sm outline-none focus:border-emerald-500"
                />
                <input
                  value={deviceKey}
                  onChange={(e) => setDeviceKey(e.target.value)}
                  placeholder="Device key"
                  type="password"
                  className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 font-mono text-sm outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={saveConfig}
                  disabled={!boxId.trim() || !deviceKey.trim()}
                  className="min-h-12 w-full rounded-xl border border-slate-600 font-semibold disabled:opacity-50"
                >
                  Connect
                </button>
              </div>
            </details>
          </div>
        )}
      </section>

      {/* Virtual hardware */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        {/* LEDs */}
        <div className="mb-4 flex items-center justify-center gap-8">
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <span
              className={`h-4 w-4 rounded-full transition ${
                redOn ? "bg-red-500 shadow-[0_0_10px_2px] shadow-red-500/60" : "bg-red-900/60"
              }`}
            />
            Red
          </span>
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <span
              className={`h-4 w-4 rounded-full transition ${
                greenOn
                  ? "bg-emerald-500 shadow-[0_0_10px_2px] shadow-emerald-500/60"
                  : "bg-emerald-900/60"
              }`}
            />
            Green
          </span>
        </div>

        {/* LCD 16x2 */}
        <div
          className="lcd mb-5 rounded-lg border-4 border-slate-800 px-3 py-3 text-center text-lg leading-7"
          aria-live="polite"
        >
          <div className="truncate">{lcd[0]}</div>
          <div className="truncate">{lcd[1]}</div>
        </div>

        {/* Lock bolt */}
        <div className="mb-5 flex items-center gap-3">
          <span className="w-14 text-xs text-slate-500">{phaseLabel}</span>
          <div className="relative h-4 flex-1 overflow-hidden rounded bg-slate-800">
            <div
              className={`absolute top-0 h-4 w-1/2 rounded transition-transform duration-500 ${
                locked ? "bg-amber-500" : "bg-emerald-500"
              } ${locked ? "translate-x-0" : "translate-x-full"}`}
            />
          </div>
        </div>

        {/* Keypad */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => pressKey(k)}
              disabled={!connected}
              className="min-h-14 rounded-xl border border-slate-700 bg-slate-800 text-xl font-bold active:bg-slate-700 disabled:opacity-40"
            >
              {k}
            </button>
          ))}
        </div>

        {/* Confirm button (replaces the reed switch) */}
        <button
          type="button"
          onClick={() => void confirmLock()}
          disabled={phase !== "open"}
          className="min-h-14 w-full rounded-xl bg-amber-500 font-bold text-slate-950 transition active:bg-amber-400 disabled:opacity-30"
        >
          Confirm &amp; lock
        </button>

        <button
          type="button"
          onClick={reboot}
          className="mt-2 min-h-11 w-full rounded-xl text-xs font-medium text-slate-500 active:text-slate-300"
        >
          Reboot box (RAM cleared, EEPROM kept)
        </button>
      </section>

      <p className="mt-4 text-center text-xs text-slate-600">
        EEPROM (used codeIds): {eeprom.current.length} · Used codes can never
        open the box again, even after a reboot.
      </p>
    </div>
  );
}
