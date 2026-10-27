"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { buttonClasses } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { EmptyState, StatusPill } from "@/components/ui/page";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { formatInteger, formatMoney, parseMoneyToCents } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { cn } from "@/lib/cn";

export interface PosProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  priceCents: number;
  quantity: number;
  categoryName?: string | null;
}

export interface PosCustomer {
  id: string;
  name: string;
  phone: string | null;
}

interface CartLine {
  product: PosProduct;
  quantity: number;
}

interface Receipt {
  id: string;
  number: string;
  totalCents: number;
  itemCount: number;
  paymentMethod: string;
  customerName: string | null;
}

const PAYMENT_METHODS = ["cash", "mobile_money", "card", "other"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

function generateKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sale-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PosTerminal({
  initialProducts,
  customers,
  currency,
  canDiscount,
  initialCustomerId,
}: {
  initialProducts: PosProduct[];
  customers: PosCustomer[];
  currency: string;
  canDiscount: boolean;
  initialCustomerId?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosProduct[]>(initialProducts);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [discount, setDiscount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const idempotencyKey = useRef<string>(generateKey());

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(initialProducts);
      setSearching(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<{ items: PosProduct[] }>(
          `/api/products/search?q=${encodeURIComponent(trimmed)}`,
        );
        if (!cancelled) {
          setResults(data.items);
          setSearchError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setSearchError(
            caught instanceof ApiClientError
              ? caught.message
              : "Recherche indisponible.",
          );
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, initialProducts]);

  const subtotalCents = useMemo(
    () => cart.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0),
    [cart],
  );
  const discountCents = discount.trim() ? parseMoneyToCents(discount) : 0;
  const discountInvalid = discount.trim().length > 0 && discountCents === null;
  const totalCents = Math.max(0, subtotalCents - (discountCents ?? 0));
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  const customer = customers.find((item) => item.id === customerId);

  function addProduct(product: PosProduct) {
    setError(null);
    const existing = cart.find((line) => line.product.id === product.id);
    const nextQuantity = (existing?.quantity ?? 0) + 1;

    if (product.quantity <= 0) {
      setError(`« ${product.name} » est en rupture de stock.`);
      return;
    }
    if (nextQuantity > product.quantity) {
      setError(
        `Stock insuffisant pour « ${product.name} » : ${product.quantity} disponible(s).`,
      );
      return;
    }

    setCart((current) => {
      const found = current.find((line) => line.product.id === product.id);
      if (found) {
        return current.map((line) =>
          line.product.id === product.id
            ? { ...line, product, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setError(null);
    setCart((current) =>
      current
        .map((line) => {
          if (line.product.id !== productId) return line;
          const next = line.quantity + delta;
          if (next > line.product.quantity) return line;
          return { ...line, quantity: next };
        })
        .filter((line) => line.quantity > 0),
    );
  }

  function removeLine(productId: string) {
    setCart((current) => current.filter((line) => line.product.id !== productId));
    setError(null);
  }

  async function handleBarcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = barcode.trim();
    if (!value || lookingUp) return;

    setLookingUp(true);
    setSearchError(null);
    try {
      const data = await apiFetch<{ items: PosProduct[] }>(
        `/api/products/search?barcode=${encodeURIComponent(value)}`,
      );
      const product = data.items[0];
      if (!product) {
        setSearchError(`Aucun produit actif avec le code-barres « ${value} ».`);
      } else {
        addProduct(product);
        setBarcode("");
      }
    } catch (caught) {
      setSearchError(
        caught instanceof ApiClientError ? caught.message : "Lecture du code-barres impossible.",
      );
    } finally {
      setLookingUp(false);
    }
  }

  async function handleCheckout() {
    if (submitting || cart.length === 0) return;

    if (discountInvalid) {
      setError("La remise doit être un montant valide.");
      return;
    }
    if (totalCents <= 0) {
      setError("Le total de la vente doit être supérieur à zéro.");
      return;
    }
    if (discountCents && discountCents > subtotalCents) {
      setError("La remise ne peut pas dépasser le sous-total.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const snapshot = {
      itemCount,
      totalCents,
      paymentMethod,
      cart: cart.map((line) => ({
        quantity: line.quantity,
        unitPriceCents: line.product.priceCents,
        name: line.product.name,
      })),
    };

    try {
      const sale = await apiFetch<{ id: string; number: string; totalCents: number }>(
        "/api/sales",
        {
          method: "POST",
          csrf: true,
          body: {
            items: cart.map((line) => ({
              productId: line.product.id,
              quantity: line.quantity,
            })),
            customerId: customerId || null,
            discountCents: discountCents ?? 0,
            paymentMethod,
            reference: reference.trim() || null,
            note: note.trim() || null,
            idempotencyKey: idempotencyKey.current,
          },
        },
      );

      setReceipt({
        id: sale.id,
        number: sale.number,
        totalCents: sale.totalCents ?? snapshot.totalCents,
        itemCount: snapshot.itemCount,
        paymentMethod: snapshot.paymentMethod,
        customerName: customer?.name ?? null,
      });
      setCart([]);
      setDiscount("");
      setReference("");
      setNote("");
      setCustomerId("");
      setQuery("");
      idempotencyKey.current = generateKey();
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "La vente n'a pas pu être enregistrée.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <div className="border-b border-line bg-primary-soft px-6 py-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary-dark">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
                <path
                  d="m6 12.5 4 4L18 7.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h2 className="mt-3 text-lg font-semibold text-primary-dark">Vente enregistrée</h2>
            <p className="tabular mt-1 font-mono text-[0.8125rem] text-primary-dark/80">
              {receipt.number}
            </p>
          </div>
          <div className="space-y-3 px-6 py-5">
            <div className="flex items-baseline justify-between">
              <span className="text-[0.8125rem] text-muted">Total encaissé</span>
              <span className="tabular font-mono text-2xl font-semibold">
                {formatMoney(receipt.totalCents, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[0.8125rem]">
              <span className="text-muted">Articles</span>
              <span>{formatInteger(receipt.itemCount)}</span>
            </div>
            <div className="flex items-center justify-between text-[0.8125rem]">
              <span className="text-muted">Paiement</span>
              <span>{PAYMENT_METHOD_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod}</span>
            </div>
            <div className="flex items-center justify-between text-[0.8125rem]">
              <span className="text-muted">Client</span>
              <span>{receipt.customerName ?? "Client de passage"}</span>
            </div>
          </div>
          <div className="grid gap-2 border-t border-line px-6 py-4 sm:grid-cols-2">
            <Link
              href={`/sales/${receipt.id}`}
              className={buttonClasses({ variant: "secondary", size: "md" })}
            >
              Voir la vente
            </Link>
            <button
              type="button"
              onClick={() => {
                setReceipt(null);
                setPaymentMethod("cash");
                setError(null);
              }}
              className={buttonClasses({ size: "md" })}
            >
              Nouvelle vente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="space-y-4">
        <section className="rounded-lg border border-line bg-white">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[0.9375rem] font-semibold">Ajouter des produits</h2>
            <p className="mt-0.5 text-[0.75rem] text-muted">
              Recherchez par nom ou SKU, ou scannez un code-barres.
            </p>
          </div>
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <label htmlFor="product-search" className="sr-only">
                Rechercher un produit
              </label>
              <div className="relative">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                >
                  <circle cx="8.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m12.5 12.5 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  id="product-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Riz, huile, SKU…"
                  autoComplete="off"
                  className="h-10 w-full rounded-md border border-line-strong bg-white pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
                {searching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.6875rem] text-muted">
                    …
                  </span>
                )}
              </div>
            </div>
            <form onSubmit={handleBarcode} className="flex items-center gap-2">
              <div>
                <label htmlFor="barcode" className="sr-only">
                  Code-barres
                </label>
                <input
                  id="barcode"
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  placeholder="Code-barres"
                  autoComplete="off"
                  className="tabular h-10 w-full rounded-md border border-line-strong bg-white px-3 font-mono text-[0.8125rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:w-40"
                />
              </div>
              <button
                type="submit"
                disabled={lookingUp || !barcode.trim()}
                className={buttonClasses({ variant: "secondary", size: "sm", className: "h-10" })}
              >
                {lookingUp ? "…" : "Ajouter"}
              </button>
            </form>
          </div>
        </section>

        {(searchError || error) && (
          <div className="rounded-md border border-red-200 bg-danger-soft px-4 py-3 text-[0.8125rem] text-red-800">
            {searchError ?? error}
          </div>
        )}

        <div>
          <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted">
            {query.trim() ? "Résultats" : "Produits disponibles"}
          </p>
          {results.length === 0 ? (
            <div className="rounded-lg border border-line bg-white p-4">
              <EmptyState
                compact
                title={query.trim() ? "Aucun produit trouvé" : "Catalogue vide"}
                body={
                  query.trim()
                    ? "Essayez un autre terme ou vérifiez l'orthographe."
                    : "Créez des produits pour commencer à vendre."
                }
              />
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {results.map((product) => {
                const inCart = cart.find((line) => line.product.id === product.id)?.quantity ?? 0;
                const soldOut = product.quantity <= 0;
                const maxed = inCart >= product.quantity;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    disabled={soldOut || maxed}
                    className={cn(
                      "group flex items-start gap-3 rounded-lg border bg-white p-3.5 text-left transition-colors",
                      soldOut || maxed
                        ? "cursor-not-allowed border-line opacity-60"
                        : "border-line hover:border-primary/50 hover:bg-primary-soft/30",
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-strong text-[0.75rem] font-semibold uppercase text-muted">
                      {product.name.slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-medium">
                        {product.name}
                      </span>
                      <span className="tabular mt-0.5 block font-mono text-[0.625rem] text-muted">
                        {product.sku}
                      </span>
                      <span className="mt-2 flex items-center justify-between gap-2">
                        <span className="tabular font-mono text-[0.8125rem] font-medium">
                          {formatMoney(product.priceCents, currency)}
                        </span>
                        <span
                          className={cn(
                            "text-[0.6875rem]",
                            soldOut
                              ? "text-danger"
                              : product.quantity <= 5
                                ? "text-warning"
                                : "text-muted",
                          )}
                        >
                          {soldOut ? "Rupture" : `${formatInteger(product.quantity)} en stock`}
                        </span>
                      </span>
                    </span>
                    {!soldOut && !maxed && (
                      <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-muted transition-colors group-hover:bg-primary group-hover:text-white">
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
                          <path
                            d="M10 4v12M4 10h12"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="xl:sticky xl:top-20 xl:self-start">
        <section className="overflow-hidden rounded-lg border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[0.9375rem] font-semibold">Panier</h2>
            <StatusPill tone={cart.length > 0 ? "success" : "neutral"}>
              {formatInteger(itemCount)} article{itemCount > 1 ? "s" : ""}
            </StatusPill>
          </div>

          {cart.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-[0.8125rem] font-medium">Le panier est vide</p>
              <p className="mt-1 text-[0.75rem] leading-5 text-muted">
                Ajoutez un produit depuis la recherche ou scannez son code-barres.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {cart.map((line) => (
                <li key={line.product.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[0.8125rem] font-medium">{line.product.name}</p>
                      <p className="tabular font-mono text-[0.625rem] text-muted">
                        {formatMoney(line.product.priceCents, currency)} / u.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.product.id)}
                      className="rounded p-1 text-muted hover:bg-danger-soft hover:text-danger"
                      aria-label={`Retirer ${line.product.name}`}
                    >
                      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
                        <path
                          d="m5 5 10 10M15 5 5 15"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-md border border-line">
                      <button
                        type="button"
                        onClick={() => changeQuantity(line.product.id, -1)}
                        className="flex h-7 w-7 items-center justify-center text-muted hover:bg-surface hover:text-ink"
                        aria-label="Diminuer la quantité"
                      >
                        −
                      </button>
                      <span className="tabular w-7 text-center font-mono text-[0.75rem]">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(line.product.id, 1)}
                        disabled={line.quantity >= line.product.quantity}
                        className="flex h-7 w-7 items-center justify-center text-muted hover:bg-surface hover:text-ink disabled:opacity-40"
                        aria-label="Augmenter la quantité"
                      >
                        +
                      </button>
                    </div>
                    <span className="tabular font-mono text-[0.8125rem] font-medium">
                      {formatMoney(line.product.priceCents * line.quantity, currency)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3 border-t border-line px-4 py-4">
            <Field label="Client" htmlFor="customerId" hint="Optionnel">
              <Select
                id="customerId"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                <option value="">Client de passage</option>
                {customers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.phone ? ` · ${item.phone}` : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <div>
              <p className="text-[0.8125rem] font-medium">Paiement</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    aria-pressed={paymentMethod === method}
                    className={cn(
                      "h-8 rounded-md border text-[0.75rem] font-medium transition-colors",
                      paymentMethod === method
                        ? "border-primary bg-primary-soft text-primary-dark"
                        : "border-line text-muted hover:border-line-strong hover:text-ink",
                    )}
                  >
                    {PAYMENT_METHOD_LABELS[method]}
                  </button>
                ))}
              </div>
            </div>

            {canDiscount && (
              <Field
                label={`Remise (${currency})`}
                htmlFor="discount"
                hint="Optionnel"
              >
                <TextInput
                  id="discount"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="h-9"
                />
                {discountInvalid && (
                  <p className="text-[0.6875rem] text-danger">Montant invalide.</p>
                )}
              </Field>
            )}

            <Field label="Référence" htmlFor="reference" hint="Optionnel">
              <TextInput
                id="reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="N° transaction, note…"
                maxLength={120}
                className="h-9"
              />
            </Field>

            <div className="space-y-1.5 border-t border-line pt-3 text-[0.8125rem]">
              <div className="flex justify-between">
                <span className="text-muted">Sous-total</span>
                <span className="tabular font-mono">
                  {formatMoney(subtotalCents, currency)}
                </span>
              </div>
              {canDiscount && (discountCents ?? 0) > 0 && (
                <div className="flex justify-between text-primary-dark">
                  <span>Remise</span>
                  <span className="tabular font-mono">
                    − {formatMoney(discountCents ?? 0, currency)}
                  </span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-line pt-2">
                <span className="font-medium">Total</span>
                <span className="tabular font-mono text-xl font-semibold">
                  {formatMoney(totalCents, currency)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={
                submitting ||
                cart.length === 0 ||
                discountInvalid ||
                totalCents <= 0
              }
              className={buttonClasses({
                size: "lg",
                className: "w-full",
              })}
            >
              {submitting ? "Encaissement…" : "Encaisser la vente"}
            </button>
            <p className="text-center text-[0.625rem] leading-4 text-muted">
              Prix et stock revérifiés côté serveur. Vente atomique et idempotente.
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
