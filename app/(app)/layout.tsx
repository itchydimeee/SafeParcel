"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { TabBar } from "@/components/tab-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pb-24 pt-6">{children}</main>
      <TabBar />
    </div>
  );
}
