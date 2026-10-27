"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClasses } from "@/components/ui/button";
import { FormError, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export function CancelSaleForm({
  saleId,
  saleNumber,
}: {
  saleId: string;
  saleNumber: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/sales/${saleId}/cancel`, {
        method: "POST",
        csrf: true,
        body: { reason: reason.trim() },
      });
      setOpen(false);
      setReason("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "Annulation impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses({
          variant: "ghost",
          size: "sm",
          className: "text-danger hover:bg-danger-soft",
        })}
      >
        Annuler la vente
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Annuler la vente ${saleNumber}`}
        description="Le stock sera réintégré et le paiement marqué comme remboursé. Cette action est irréversible."
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormError message={error} />
          <div className="space-y-1.5">
            <label htmlFor="cancel-reason" className="text-[0.8125rem] font-medium">
              Motif de l&apos;annulation
            </label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={3}
              maxLength={500}
              placeholder="Erreur de saisie, retour client…"
              className="min-h-20"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Conserver la vente
            </button>
            <button
              type="submit"
              disabled={loading || reason.trim().length < 3}
              className={buttonClasses({ variant: "danger", size: "sm" })}
            >
              {loading ? "Annulation…" : "Confirmer l'annulation"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
