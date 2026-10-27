"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { buttonClasses } from "@/components/ui/button";
import {
  Field,
  FormError,
  Select,
  TextInput,
  Textarea,
} from "@/components/ui/field";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { centsToInput, parseMoneyToCents } from "@/lib/money";

export interface ProductFormProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  categoryId: string | null;
  supplierId: string | null;
  priceCents: number;
  costCents: number | null;
  minStock: number;
  quantity: number;
}

export function ProductForm({
  mode,
  product,
  categories,
  suppliers,
  currency,
}: {
  mode: "create" | "edit";
  product?: ProductFormProduct;
  categories: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
  currency: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [supplierId, setSupplierId] = useState(product?.supplierId ?? "");
  const [price, setPrice] = useState(centsToInput(product?.priceCents));
  const [cost, setCost] = useState(centsToInput(product?.costCents));
  const [minStock, setMinStock] = useState(String(product?.minStock ?? 0));
  const [initialQuantity, setInitialQuantity] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function suggestSku() {
    if (sku.trim()) return;
    const base = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 18);
    if (!base) return;
    setSku(`${base || "ART"}-${Math.floor(100 + Math.random() * 900)}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const priceCents = parseMoneyToCents(price);
    if (priceCents === null) {
      setError("Indiquez un prix de vente valide, par exemple 4250 ou 4250,50.");
      return;
    }

    const costCents = cost.trim() ? parseMoneyToCents(cost) : null;
    if (cost.trim() && costCents === null) {
      setError("Le prix d'achat doit être un montant valide.");
      return;
    }

    const minStockValue = Number.parseInt(minStock || "0", 10);
    if (!Number.isFinite(minStockValue) || minStockValue < 0) {
      setError("Le seuil de stock doit être un entier positif.");
      return;
    }

    const initialValue = Number.parseInt(initialQuantity || "0", 10);
    if (!Number.isFinite(initialValue) || initialValue < 0) {
      setError("La quantité initiale doit être un entier positif.");
      return;
    }

    setLoading(true);
    setError(null);

    const body = {
      name: name.trim(),
      sku: sku.trim(),
      barcode: barcode.trim() || null,
      description: description.trim() || null,
      categoryId: categoryId || null,
      supplierId: supplierId || null,
      priceCents,
      costCents,
      minStock: minStockValue,
      ...(mode === "create" ? { initialQuantity: initialValue } : {}),
    };

    try {
      if (mode === "create") {
        const created = await apiFetch<{ id: string }>("/api/products", {
          method: "POST",
          csrf: true,
          body,
        });
        router.push(`/products/${created.id}`);
        router.refresh();
      } else if (product) {
        await apiFetch(`/api/products/${product.id}`, {
          method: "PATCH",
          csrf: true,
          body,
        });
        router.push(`/products/${product.id}`);
        router.refresh();
      }
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Une erreur est survenue. Réessayez.",
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormError message={error} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-lg border border-line bg-white">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[0.9375rem] font-semibold">Informations produit</h2>
            <p className="mt-0.5 text-[0.75rem] text-muted">
              Le nom et le SKU apparaissent sur les tickets et les rapports.
            </p>
          </div>
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <Field label="Nom du produit" htmlFor="name" className="sm:col-span-2">
              <TextInput
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={suggestSku}
                required
                maxLength={160}
                placeholder="Riz parfumé 5 kg"
              />
            </Field>
            <Field label="SKU" htmlFor="sku" hint="Référence interne">
              <TextInput
                id="sku"
                value={sku}
                onChange={(event) => setSku(event.target.value.toUpperCase())}
                required
                maxLength={64}
                placeholder="RIZ-5KG"
              />
            </Field>
            <Field label="Code-barres" htmlFor="barcode" hint="Optionnel">
              <TextInput
                id="barcode"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                maxLength={64}
                placeholder="6001234567890"
                inputMode="numeric"
              />
            </Field>
            <Field label="Catégorie" htmlFor="categoryId">
              <Select
                id="categoryId"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Sans catégorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fournisseur" htmlFor="supplierId">
              <Select
                id="supplierId"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                <option value="">Sans fournisseur</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Description"
              htmlFor="description"
              hint="Optionnel"
              className="sm:col-span-2"
            >
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                placeholder="Conditionnement, variété, notes internes…"
              />
            </Field>
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-lg border border-line bg-white">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[0.9375rem] font-semibold">Prix et stock</h2>
              <p className="mt-0.5 text-[0.75rem] text-muted">
                Montants en {currency}.
              </p>
            </div>
            <div className="space-y-4 px-5 py-5">
              <Field label={`Prix de vente (${currency})`} htmlFor="price">
                <TextInput
                  id="price"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  required
                  inputMode="decimal"
                  placeholder="4250"
                />
              </Field>
              <Field
                label={`Prix d'achat (${currency})`}
                htmlFor="cost"
                hint="Optionnel"
              >
                <TextInput
                  id="cost"
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                  inputMode="decimal"
                  placeholder="3100"
                />
              </Field>
              <Field
                label="Seuil d'alerte"
                htmlFor="minStock"
                hint="Unités"
              >
                <TextInput
                  id="minStock"
                  value={minStock}
                  onChange={(event) => setMinStock(event.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </Field>
              {mode === "create" ? (
                <Field
                  label="Stock initial"
                  htmlFor="initialQuantity"
                  hint="Crée une entrée"
                >
                  <TextInput
                    id="initialQuantity"
                    value={initialQuantity}
                    onChange={(event) => setInitialQuantity(event.target.value)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </Field>
              ) : (
                <div className="rounded-md border border-line bg-surface px-3 py-2.5">
                  <p className="text-[0.6875rem] font-medium text-muted">
                    Stock actuel
                  </p>
                  <p className="tabular mt-0.5 font-mono text-lg font-medium">
                    {product?.quantity ?? 0} unités
                  </p>
                  <p className="mt-1 text-[0.6875rem] leading-5 text-muted">
                    Modifiez le stock depuis un mouvement pour conserver l&apos;historique.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
        <Link
          href={product ? `/products/${product.id}` : "/products"}
          className={buttonClasses({ variant: "secondary", size: "md" })}
        >
          Annuler
        </Link>
        <button type="submit" disabled={loading} className={buttonClasses({ size: "md" })}>
          {loading ? "Enregistrement…" : mode === "create" ? "Créer le produit" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
