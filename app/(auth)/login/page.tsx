"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from "@/components/auth-provider";
import { auth, db, googleProvider } from "@/lib/firebase-client";

async function ensureUserDoc(user: User) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      name: user.displayName ?? "",
      email: user.email ?? "",
    },
    { merge: true }
  );
}

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  // Surface any error left over from a redirect-based Google sign-in.
  useEffect(() => {
    getRedirectResult(auth).catch((e) => setError(messageFor(e)));
  }, []);

  function messageFor(e: unknown): string {
    const code = (e as { code?: string })?.code ?? "";
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Incorrect email or password.";
      case "auth/email-already-in-use":
        return "That email is already registered. Sign in instead.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/operation-not-allowed":
        return "That sign-in provider isn't enabled in Firebase yet.";
      default:
        return e instanceof Error ? e.message : "Something went wrong.";
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const cred =
        mode === "signin"
          ? await signInWithEmailAndPassword(auth, email.trim(), password)
          : await createUserWithEmailAndPassword(
              auth,
              email.trim(),
              password
            );
      await ensureUserDoc(cred.user);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await ensureUserDoc(cred.user);
    } catch (e) {
      // Popup blocked (common on mobile): fall back to a full redirect.
      if ((e as { code?: string })?.code === "auth/popup-blocked") {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (e2) {
          setError(messageFor(e2));
        }
      } else {
        setError(messageFor(e));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="M3.3 7 12 12l8.7-5" />
            <path d="M12 22V12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">SafeParcel</h1>
        <p className="mt-1 text-sm text-slate-400">
          One-time passcodes for your delivery box
        </p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-base outline-none placeholder:text-slate-500 focus:border-emerald-500"
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-base outline-none placeholder:text-slate-500 focus:border-emerald-500"
        />

        {error && (
          <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="min-h-12 w-full rounded-xl bg-emerald-500 font-semibold text-slate-950 transition active:bg-emerald-400 disabled:opacity-50"
        >
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="min-h-12 w-full rounded-xl text-sm font-medium text-slate-400 active:text-slate-200"
        >
          {mode === "signin"
            ? "New here? Create an account"
            : "Have an account? Sign in"}
        </button>

        <div className="flex items-center gap-3 py-2 text-xs text-slate-500">
          <div className="h-px flex-1 bg-slate-800" />
          OR
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={busy}
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-900 font-medium transition active:bg-slate-800 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
          </svg>
          Continue with Google
        </button>
      </form>
    </div>
  );
}
