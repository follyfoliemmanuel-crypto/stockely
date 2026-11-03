"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export function AiSummary({ from, to }: { from: string; to: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState(`${from}|${to}`);

  useEffect(() => {
    const next = `${from}|${to}`;
    if (next === range) return;
    setRange(next);
    setSummary(null);
    setError(null);
  }, [from, to, range]);

  async function generate() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ summary: string }>("/api/ai/summary", {
        method: "POST",
        csrf: true,
        body: { from, to },
      });
      setSummary(result.summary);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "La synthèse est indisponible. Réessayez.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line/90 bg-white shadow-card">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-[0.9375rem] font-bold tracking-[-0.02em]">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-primary-dark">
              <Icon name="sparkles" className="h-3.5 w-3.5" />
            </span>
            Synthèse IA
          </h2>
          <p className="mt-1 text-[0.75rem] leading-5 text-muted">
            Un compte-rendu de la période : tendance, marge, encaissements et
            points d&apos;attention.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={loading}
          onClick={generate}
          className="shrink-0"
        >
          {!loading && <Icon name="sparkles" className="h-3.5 w-3.5" />}
          {loading ? "Analyse en cours…" : summary ? "Regénérer" : "Résumé IA"}
        </Button>
      </div>

      {(summary || error || loading) && (
        <div className="border-t border-line/80 px-5 py-4">
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-danger/15 bg-danger-soft px-3.5 py-3 text-[0.8125rem] leading-6 text-danger"
            >
              {error}
            </p>
          ) : summary ? (
            <p className="whitespace-pre-wrap text-[0.8125rem] leading-6 text-ink">
              {summary}
            </p>
          ) : (
            <p className="text-[0.8125rem] text-muted">
              Lecture des ventes et du stock de la période…
            </p>
          )}
          {summary && (
            <p className="mt-3 border-t border-line/70 pt-2.5 text-[0.625rem] leading-4 text-muted">
              Texte généré par IA à partir des données de la boutique. Vérifiez les
              montants avant toute décision.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
