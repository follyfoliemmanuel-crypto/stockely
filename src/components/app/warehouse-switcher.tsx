"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiClientError, apiFetch } from "@/lib/api-client";

export interface SwitchableWarehouse {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
}

export function WarehouseSwitcher({
  warehouses,
  activeWarehouseId,
}: {
  warehouses: SwitchableWarehouse[];
  activeWarehouseId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active =
    warehouses.find((warehouse) => warehouse.id === activeWarehouseId) ??
    warehouses[0];

  if (!active) return null;

  async function handleChange(warehouseId: string) {
    if (warehouseId === activeWarehouseId || loading) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/warehouses/switch", {
        method: "POST",
        csrf: true,
        body: { warehouseId },
      });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Impossible de changer d'entrepôt.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label
        htmlFor="warehouse-switcher"
        className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-muted/70"
      >
        Entrepôt de travail
      </label>
      {warehouses.length > 1 ? (
        <select
          id="warehouse-switcher"
          value={active.id}
          disabled={loading}
          onChange={(event) => handleChange(event.target.value)}
          className="mt-1.5 h-8 w-full truncate rounded-lg border border-line bg-white px-2 text-[0.8125rem] font-semibold text-ink shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
        >
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name} · {warehouse.code}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-1.5 truncate text-[0.8125rem] font-semibold text-ink">
          {active.name}{" "}
          <span className="font-mono text-[0.6875rem] text-muted">
            {active.code}
          </span>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-[0.6875rem] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
