"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormError, FormSuccess, Select, TextInput } from "@/components/ui/field";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import type { Warehouse } from "@/server/db/schema";

interface TransferItemState {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
}

interface AvailableProduct {
  id: string;
  name: string;
  sku: string;
}

export function TransferCreateForm({
  warehouses,
  initialFromWarehouseId,
  availableProducts,
}: {
  warehouses: Warehouse[];
  initialFromWarehouseId?: string;
  availableProducts: AvailableProduct[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [fromWarehouseId, setFromWarehouseId] = useState(
    initialFromWarehouseId ?? warehouses[0]?.id ?? "",
  );
  const [toWarehouseId, setToWarehouseId] = useState(
    warehouses.find((w) => w.id !== fromWarehouseId)?.id ?? "",
  );
  const [note, setNote] = useState("");
  const [items, setItems] = useState<TransferItemState[]>([]);

  // Produit en cours d'ajout
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleAddItem() {
    if (!selectedProductId || selectedQuantity <= 0) return;
    const prod = availableProducts.find((p) => p.id === selectedProductId);
    if (!prod) return;

    if (items.some((i) => i.productId === selectedProductId)) {
      setItems((prev) =>
        prev.map((i) =>
          i.productId === selectedProductId
            ? { ...i, quantity: i.quantity + selectedQuantity }
            : i,
        ),
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          sku: prod.sku,
          quantity: selectedQuantity,
        },
      ]);
    }

    setSelectedProductId("");
    setSelectedQuantity(1);
  }

  function handleRemoveItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (fromWarehouseId === toWarehouseId) {
      setError("L'entrepôt de départ et l'entrepôt d'arrivée doivent être différents.");
      return;
    }

    if (items.length === 0) {
      setError("Veuillez ajouter au moins un produit à transférer.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const idempotencyKey = `trf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const res = await apiFetch<{ transferId: string; number: string }>(
        "/api/transfers",
        {
          method: "POST",
          csrf: true,
          body: {
            fromWarehouseId,
            toWarehouseId,
            note: note.trim() || null,
            items: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
            idempotencyKey,
          },
        },
      );

      setSuccess(`Transfert ${res.number} créé avec succès.`);
      startTransition(() => {
        router.push(`/transfers/${res.transferId}`);
        router.refresh();
      });
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Création du transfert impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <FormError message={error} />}
      {success && <FormSuccess message={success} />}

      <div className="rounded-xl border border-line bg-surface p-5 shadow-xs">
        <h3 className="mb-4 text-base font-semibold text-ink">
          1. Itinéraire du transfert
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Entrepôt d'origine (Départ)" htmlFor="from-warehouse">
            <Select
              id="from-warehouse"
              value={fromWarehouseId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                const newFrom = e.target.value;
                setFromWarehouseId(newFrom);
                if (newFrom === toWarehouseId) {
                  const alt = warehouses.find((w) => w.id !== newFrom);
                  if (alt) setToWarehouseId(alt.id);
                }
              }}
              required
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Entrepôt de destination (Arrivée)" htmlFor="to-warehouse">
            <Select
              id="to-warehouse"
              value={toWarehouseId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setToWarehouseId(e.target.value)}
              required
            >
              {warehouses
                .filter((w) => w.id !== fromWarehouseId)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Note ou instructions de transport (facultatif)" htmlFor="transfer-note">
            <TextInput
              id="transfer-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Réapprovisionnement urgent par camionnette A..."
              maxLength={500}
            />
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 shadow-xs">
        <h3 className="mb-4 text-base font-semibold text-ink">
          2. Articles à transférer
        </h3>

        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] items-end">
          <Field label="Sélectionner un produit" htmlFor="select-product">
            <Select
              id="select-product"
              value={selectedProductId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedProductId(e.target.value)}
            >
              <option value="">-- Choisir un produit --</option>
              {availableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (SKU: {p.sku})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Quantité" htmlFor="select-quantity">
            <TextInput
              id="select-quantity"
              type="number"
              min={1}
              value={selectedQuantity}
              onChange={(e) => setSelectedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </Field>

          <Button
            type="button"
            variant="secondary"
            onClick={handleAddItem}
            disabled={!selectedProductId}
          >
            Ajouter la ligne
          </Button>
        </div>

        {items.length > 0 ? (
          <div className="mt-5 overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-strong text-xs font-semibold uppercase text-muted">
                <tr>
                  <th className="px-4 py-2.5">Produit</th>
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-4 py-2.5 text-right">Quantité à transférer</th>
                  <th className="px-4 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item) => (
                  <tr key={item.productId} className="hover:bg-surface-strong/50">
                    <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                    <td className="px-4 py-3 text-muted">{item.sku}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.productId)}
                        className="text-xs text-danger hover:underline"
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-center text-sm text-muted">
            Aucun article dans ce transfert. Ajoutez-en au moins un ci-dessus.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/transfers")}
          disabled={loading}
        >
          Annuler
        </Button>
        <Button type="submit" loading={loading} disabled={items.length === 0}>
          Préparer le transfert ({items.reduce((acc, i) => acc + i.quantity, 0)} articles)
        </Button>
      </div>
    </form>
  );
}
