"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { buttonClasses } from "@/components/ui/button";
import { Field, FormError, Select, TextInput, Textarea } from "@/components/ui/field";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { centsToInput, formatInteger, parseMoneyToCents } from "@/lib/money";
import { cn } from "@/lib/cn";

export interface StockProductOption {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  costCents: number | null;
}

type MovementType = "in" | "out" | "adjustment";

const TYPES: Array<{
  value: MovementType;
  label: string;
  description: string;
}> = [
  {
    value: "in",
    label: "Entrée",
    description: "Réception, retour client ou réapprovisionnement.",
  },
  {
    value: "out",
    label: "Sortie",
    description: "Perte, casse ou consommation interne.",
  },
  {
    value: "adjustment",
    label: "Correction",
    description: "Alignement sur la quantité physique constatée.",
  },
];

export function StockMovementForm({
  products,
  currency,
  initialProductId,
}: {
  products: StockProductOption[];
  currency: string;
  initialProductId?: string;
}) {
  const router = useRouter();
  const initial =
    products.find((product) => product.id === initialProductId) ?? products[0];
  const [productId, setProductId] = useState(initial?.id ?? "");
  const [type, setType] = useState<MovementType>("in");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState(centsToInput(initial?.costCents));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const product = useMemo(
    () => products.find((item) => item.id === productId),
    [products, productId],
  );

  const parsedQuantity = Number.parseInt(quantity, 10);
  const hasQuantity = Number.isFinite(parsedQuantity) && parsedQuantity >= 0;
  const delta =
    hasQuantity && product
      ? type === "in"
        ? parsedQuantity
        : type === "out"
          ? -parsedQuantity
          : parsedQuantity - product.quantity
      : null;
  const nextQuantity =
    product && delta !== null ? product.quantity + delta : null;

  function handleProductChange(nextId: string) {
    setProductId(nextId);
    const next = products.find((item) => item.id === nextId);
    setUnitCost(centsToInput(next?.costCents));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!product) {
      setError("Sélectionnez un produit.");
      return;
    }
    if (!hasQuantity || (type !== "adjustment" && parsedQuantity < 1)) {
      setError("Indiquez une quantité valide.");
      return;
    }
    if (nextQuantity !== null && nextQuantity < 0) {
      setError(`Stock insuffisant : ${formatInteger(product.quantity)} unité(s) disponible(s).`);
      return;
    }

    let unitCostCents: number | null = null;
    if (type === "in" && unitCost.trim()) {
      unitCostCents = parseMoneyToCents(unitCost);
      if (unitCostCents === null) {
        setError("Le prix d'achat doit être un montant valide.");
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/stock", {
        method: "POST",
        csrf: true,
        body: {
          productId: product.id,
          type,
          quantity: parsedQuantity,
          unitCostCents,
          reason: reason.trim() || null,
        },
      });
      router.push(`/products/${product.id}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "Mouvement impossible.",
      );
      setLoading(false);
    }
  }

  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface px-5 py-8 text-center">
        <p className="text-[0.875rem] font-medium">Aucun produit disponible</p>
        <p className="mt-1 text-[0.8125rem] text-muted">
          Créez d&apos;abord un produit actif pour enregistrer un mouvement.
        </p>
        <Link href="/products/new" className={cn(buttonClasses({ size: "sm" }), "mt-4")}>
          Créer un produit
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        <FormError message={error} />

        <section className="rounded-lg border border-line bg-white">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[0.9375rem] font-semibold">Type de mouvement</h2>
            <p className="mt-0.5 text-[0.75rem] text-muted">
              Chaque opération est atomique, datée et conservée dans l&apos;historique.
            </p>
          </div>
          <div className="grid gap-2 px-5 py-4 sm:grid-cols-3">
            {TYPES.map((option) => {
              const active = type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-md border p-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary-soft"
                      : "border-line hover:border-line-strong hover:bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "text-[0.8125rem] font-medium",
                      active && "text-primary-dark",
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-[0.6875rem] leading-5 text-muted">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 border-t border-line px-5 py-5 sm:grid-cols-2">
            <Field label="Produit" htmlFor="productId" className="sm:col-span-2">
              <Select
                id="productId"
                value={productId}
                onChange={(event) => handleProductChange(event.target.value)}
                required
              >
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.sku} ({item.quantity} en stock)
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={
                type === "adjustment"
                  ? "Quantité physique constatée"
                  : "Quantité"
              }
              htmlFor="quantity"
              hint={
                type === "adjustment"
                  ? "Nouveau stock réel"
                  : type === "in"
                    ? "Unités à ajouter"
                    : "Unités à retirer"
              }
            >
              <TextInput
                id="quantity"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                required
                placeholder="0"
              />
            </Field>
            {type === "in" ? (
              <Field
                label={`Prix d'achat unitaire (${currency})`}
                htmlFor="unitCost"
                hint="Optionnel"
              >
                <TextInput
                  id="unitCost"
                  value={unitCost}
                  onChange={(event) => setUnitCost(event.target.value)}
                  inputMode="decimal"
                  placeholder="3100"
                />
              </Field>
            ) : (
              <div className="rounded-md border border-line bg-surface px-3 py-2.5">
                <p className="text-[0.6875rem] font-medium text-muted">Stock actuel</p>
                <p className="tabular mt-0.5 font-mono text-lg font-medium">
                  {formatInteger(product?.quantity ?? 0)} u.
                </p>
              </div>
            )}
            <Field
              label="Motif"
              htmlFor="reason"
              hint="Optionnel"
              className="sm:col-span-2"
            >
              <Textarea
                id="reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                className="min-h-20"
                placeholder={
                  type === "in"
                    ? "Réception fournisseur, retour client…"
                    : type === "out"
                      ? "Casse, perte, usage interne…"
                      : "Inventaire du 26 octobre…"
                }
              />
            </Field>
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-lg border border-line bg-white p-5">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted">
            Aperçu
          </p>
          <dl className="mt-3 space-y-2.5 text-[0.8125rem]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Stock actuel</dt>
              <dd className="tabular font-mono">{formatInteger(product?.quantity ?? 0)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Variation</dt>
              <dd
                className={cn(
                  "tabular font-mono font-medium",
                  delta === null
                    ? "text-muted"
                    : delta > 0
                      ? "text-primary-dark"
                      : delta < 0
                        ? "text-danger"
                        : "text-muted",
                )}
              >
                {delta === null ? "—" : `${delta > 0 ? "+" : ""}${formatInteger(delta)}`}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-2.5">
              <dt className="font-medium">Nouveau stock</dt>
              <dd
                className={cn(
                  "tabular font-mono font-semibold",
                  nextQuantity !== null && nextQuantity < 0 && "text-danger",
                )}
              >
                {nextQuantity === null ? "—" : `${formatInteger(nextQuantity)} u.`}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[0.6875rem] leading-5 text-muted">
            Le serveur revérifie le stock sous verrou avant d&apos;enregistrer.
          </p>
        </section>

        <div className="flex flex-col gap-2">
          <button type="submit" disabled={loading} className={buttonClasses({ size: "md" })}>
            {loading ? "Enregistrement…" : "Enregistrer le mouvement"}
          </button>
          <Link
            href="/stock"
            className={buttonClasses({ variant: "secondary", size: "md" })}
          >
            Annuler
          </Link>
        </div>
      </aside>
    </form>
  );
}
