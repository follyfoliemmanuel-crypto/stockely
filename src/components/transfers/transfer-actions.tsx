"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormError, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import type { TransferDetail } from "@/server/services/transfers";

export function TransferActions({
  transfer,
  canShip,
  canReceive,
  canCancel,
}: {
  transfer: TransferDetail;
  canShip: boolean;
  canReceive: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [shipNote, setShipNote] = useState("");

  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveItems, setReceiveItems] = useState(
    transfer.items.map((i) => ({
      productId: i.productId,
      name: i.productName,
      quantitySent: i.quantitySent,
      quantityReceived: i.quantitySent, // par défaut tout est reçu
      discrepancyReason: "",
    })),
  );
  const [receiveNote, setReceiveNote] = useState("");

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  async function handleShip() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/transfers/${transfer.id}/ship`, {
        method: "POST",
        csrf: true,
        body: { note: shipNote.trim() || null },
      });
      setIsShipModalOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "Expédition impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleReceive() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/transfers/${transfer.id}/receive`, {
        method: "POST",
        csrf: true,
        body: {
          items: receiveItems.map((i) => ({
            productId: i.productId,
            quantityReceived: i.quantityReceived,
            discrepancyReason:
              i.quantityReceived < i.quantitySent ? i.discrepancyReason.trim() || null : null,
          })),
          note: receiveNote.trim() || null,
        },
      });
      setIsReceiveModalOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "Réception impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) {
      setError("Le motif d'annulation est obligatoire.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/transfers/${transfer.id}/cancel`, {
        method: "POST",
        csrf: true,
        body: { reason: cancelReason.trim() },
      });
      setIsCancelModalOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "Annulation impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  const isPrepared = transfer.status === "prepared";
  const isShipped = transfer.status === "shipped";
  const isFinal = transfer.status === "received" || transfer.status === "cancelled";

  if (isFinal) return null;

  return (
    <div className="space-y-3">
      {error && <FormError message={error} />}

      <div className="flex flex-wrap gap-2">
        {isPrepared && canShip && (
          <Button
            type="button"
            variant="primary"
            onClick={() => setIsShipModalOpen(true)}
            disabled={loading}
          >
            Marquer comme expédié
          </Button>
        )}

        {(isPrepared || isShipped) && canReceive && (
          <Button
            type="button"
            variant="primary"
            onClick={() => setIsReceiveModalOpen(true)}
            disabled={loading}
          >
            Confirmer la réception
          </Button>
        )}

        {canCancel && (
          <Button
            type="button"
            variant="danger"
            onClick={() => setIsCancelModalOpen(true)}
            disabled={loading}
          >
            Annuler le transfert
          </Button>
        )}
      </div>

      {/* Modal Expédition */}
      <Modal
        open={isShipModalOpen}
        onClose={() => setIsShipModalOpen(false)}
        title="Expédier le transfert"
        description={`Confirmez le départ des marchandises depuis ${transfer.fromWarehouse.name}.`}
      >
        <div className="space-y-4">
          <Field label="Note de transport (facultatif)" htmlFor="ship-note">
            <TextInput
              id="ship-note"
              value={shipNote}
              onChange={(e) => setShipNote(e.target.value)}
              placeholder="Ex: Chauffeur Moussa, véhicule n°12..."
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsShipModalOpen(false)}>
              Fermer
            </Button>
            <Button variant="primary" loading={loading} onClick={handleShip}>
              Confirmer l'expédition
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Réception */}
      <Modal
        open={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        title="Réceptionner le transfert"
        description={`Vérifiez les quantités reçues dans ${transfer.toWarehouse.name}. Tout écart sera déduit du stock global et tracé.`}
      >
        <div className="space-y-4">
          <div className="max-h-72 overflow-y-auto space-y-3">
            {receiveItems.map((item, idx) => {
              const hasDiscrepancy = item.quantityReceived < item.quantitySent;
              return (
                <div
                  key={item.productId}
                  className="rounded-lg border border-border bg-surface-subtle p-3 space-y-2 text-sm"
                >
                  <div className="flex justify-between items-center font-medium">
                    <span>{item.name}</span>
                    <span className="text-muted text-xs">
                      Expédié : <strong>{item.quantitySent}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-[130px_1fr] gap-2 items-center">
                    <Field label="Quantité reçue" htmlFor={`qty-${item.productId}`}>
                      <TextInput
                        id={`qty-${item.productId}`}
                        type="number"
                        min={0}
                        max={item.quantitySent}
                        value={item.quantityReceived}
                        onChange={(e) => {
                          const val = Math.min(
                            item.quantitySent,
                            Math.max(0, parseInt(e.target.value) || 0),
                          );
                          setReceiveItems((prev) =>
                            prev.map((i, iIdx) =>
                              iIdx === idx ? { ...i, quantityReceived: val } : i,
                            ),
                          );
                        }}
                      />
                    </Field>
                    {hasDiscrepancy && (
                      <Field
                        label={`Motif de l'écart (${item.quantitySent - item.quantityReceived} manquant)`}
                        htmlFor={`disc-${item.productId}`}
                      >
                        <TextInput
                          id={`disc-${item.productId}`}
                          placeholder="Ex: Casse en route, colis percé..."
                          value={item.discrepancyReason}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReceiveItems((prev) =>
                              prev.map((i, iIdx) =>
                                iIdx === idx ? { ...i, discrepancyReason: val } : i,
                              ),
                            );
                          }}
                        />
                      </Field>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Field label="Commentaire général (facultatif)" htmlFor="receive-note">
            <TextInput
              id="receive-note"
              value={receiveNote}
              onChange={(e) => setReceiveNote(e.target.value)}
              placeholder="Ex: Réception effectuée par l'équipe du matin"
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsReceiveModalOpen(false)}>
              Fermer
            </Button>
            <Button variant="primary" loading={loading} onClick={handleReceive}>
              Valider la réception
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Annulation */}
      <Modal
        open={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Annuler le transfert"
        description="Les marchandises seront intégralement réintégrées dans l'entrepôt d'origine."
      >
        <div className="space-y-4">
          <Field label="Motif d'annulation" htmlFor="cancel-reason">
            <TextInput
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex: Erreur de saisie, annulation du besoin..."
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsCancelModalOpen(false)}>
              Retour
            </Button>
            <Button
              variant="danger"
              loading={loading}
              onClick={handleCancel}
              disabled={!cancelReason.trim()}
            >
              Confirmer l'annulation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
