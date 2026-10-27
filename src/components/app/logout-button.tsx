"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api-client";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST", csrf: true });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-label={compact ? "Se déconnecter" : undefined}
      className={
        compact
          ? "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-muted shadow-soft transition-colors hover:bg-surface hover:text-ink disabled:opacity-60"
          : "inline-flex h-9 items-center gap-2 rounded-xl px-2.5 text-[0.8125rem] font-semibold text-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-60"
      }
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
        <path
          d="M12.5 6.5V4.8A1.8 1.8 0 0 0 10.7 3H5.3a1.8 1.8 0 0 0-1.8 1.8v10.4A1.8 1.8 0 0 0 5.3 17h5.4a1.8 1.8 0 0 0 1.8-1.8v-1.7M8.5 10h9m0 0-2.8-2.8M17.5 10l-2.8 2.8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {compact ? (
        <span className="sr-only">{loading ? "Déconnexion…" : "Se déconnecter"}</span>
      ) : (
        <span>{loading ? "Déconnexion…" : "Se déconnecter"}</span>
      )}
    </button>
  );
}
