"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiClientError, apiFetch } from "@/lib/api-client";

export interface SwitchableShop {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
}

export function ShopSwitcher({
  shops,
  activeShopId,
}: {
  shops: SwitchableShop[];
  activeShopId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = shops.find((shop) => shop.id === activeShopId) ?? shops[0];

  if (!active) return null;

  async function handleChange(shopId: string) {
    if (shopId === activeShopId || loading) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/shops/switch", {
        method: "POST",
        csrf: true,
        body: { shopId },
      });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Impossible de changer de boutique.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label
        htmlFor="shop-switcher"
        className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-muted/70"
      >
        Boutique
      </label>
      {shops.length > 1 ? (
        <select
          id="shop-switcher"
          value={active.id}
          disabled={loading}
          onChange={(event) => handleChange(event.target.value)}
          className="mt-1.5 h-8 w-full truncate rounded-lg border border-line bg-white px-2 text-[0.8125rem] font-semibold text-ink shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
        >
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-1.5 truncate text-[0.8125rem] font-semibold text-ink">
          {active.name}
        </p>
      )}
      <p className="tabular mt-1 truncate font-mono text-[0.625rem] text-muted">
        {active.currency} · {active.timezone}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-[0.6875rem] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
