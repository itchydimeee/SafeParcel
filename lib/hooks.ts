"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import type { BoxDoc, CodeDoc, EventDoc, UserDoc } from "@/lib/types";

export interface FirestoreState<T> {
  data: T | null;
  loading: boolean;
}

function useDoc<T>(path: string | null): FirestoreState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      doc(db, path),
      (snap) => {
        setData(snap.exists() ? (snap.data() as T) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [path]);

  return { data, loading };
}

export function useUserDoc(uid: string | null) {
  const { data, loading } = useDoc<UserDoc>(uid ? `users/${uid}` : null);
  return { userDoc: data, loading };
}

export function useBox(boxId: string | null) {
  const { data, loading } = useDoc<BoxDoc>(boxId ? `boxes/${boxId}` : null);
  return { box: data, loading };
}

export function useCodeDoc(boxId: string | null) {
  const { data, loading } = useDoc<CodeDoc>(
    boxId ? `boxes/${boxId}/private/code` : null
  );
  return { code: data, loading };
}

export function useEvents(boxId: string | null) {
  const [events, setEvents] = useState<(EventDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(!!boxId);

  useEffect(() => {
    if (!boxId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, `boxes/${boxId}/events`),
      orderBy("at", "desc"),
      limit(50)
    );
    return onSnapshot(
      q,
      (snap) => {
        setEvents(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as EventDoc) }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [boxId]);

  return { events, loading };
}

/** Re-render on an interval so countdowns and online dots stay fresh. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
