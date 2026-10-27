"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClasses } from "@/components/ui/button";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export function ProductArchiveButton({
  productId,
  archived,
  productName,
}: {
  productId: string;
  archived: boolean;
  productName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (loading) return;
    const message = archived
      ? `Restaurer « ${productName} » dans le catalogue actif ?`
      : `Archiver « ${productName} » ? Il ne sera plus proposé à la vente.`;
    if (!window.confirm(message)) return;

    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/products/${productId}/archive`, {
        method: "POST",
        csrf: true,
        body: { archived: !archived },
      });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "Action impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={buttonClasses({
          variant: archived ? "secondary" : "ghost",
          size: "sm",
          className: archived ? "" : "text-danger hover:bg-danger-soft",
        })}
      >
        {loading ? "…" : archived ? "Restaurer" : "Archiver"}
      </button>
      {error && <p className="mt-1 text-[0.6875rem] text-danger">{error}</p>}
    </div>
  );
}
