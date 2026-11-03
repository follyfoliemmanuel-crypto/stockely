"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icons";
import { ApiClientError, apiFetch } from "@/lib/api-client";

/**
 * Bouton d'aide à la saisie : propose une description à partir du nom du
 * produit. L'utilisateur garde la main et peut modifier le texte proposé.
 */
export function AiDescriptionButton({
  name,
  categoryName,
  priceCents,
  onDescription,
}: {
  name: string;
  categoryName: string | null;
  priceCents: number | null;
  onDescription: (description: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    if (loading || name.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ description: string }>(
        "/api/ai/product-description",
        {
          method: "POST",
          csrf: true,
          body: { name: name.trim(), categoryName, priceCents },
        },
      );
      onDescription(result.description);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "L'aide IA est indisponible. Réessayez.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error && (
        <span role="alert" className="mr-auto text-[0.6875rem] text-danger">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={suggest}
        disabled={loading || name.trim().length < 2}
        title={
          name.trim().length < 2
            ? "Saisissez d'abord le nom du produit"
            : "Proposer une description"
        }
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-[0.6875rem] font-semibold text-muted transition-colors hover:border-primary/30 hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span
            aria-hidden="true"
            className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          <Icon name="sparkles" className="h-3.5 w-3.5" />
        )}
        {loading ? "Rédaction…" : "Suggérer avec l'IA"}
      </button>
    </div>
  );
}
