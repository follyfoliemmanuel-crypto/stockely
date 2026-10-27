"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { buttonClasses } from "@/components/ui/button";
import {
  Field,
  FormError,
  TextInput,
  Textarea,
} from "@/components/ui/field";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export interface ContactValues {
  id?: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

export function ContactForm({
  kind,
  mode,
  contact,
}: {
  kind: "customer" | "supplier";
  mode: "create" | "edit";
  contact?: ContactValues;
}) {
  const router = useRouter();
  const [name, setName] = useState(contact?.name ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [address, setAddress] = useState(contact?.address ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isCustomer = kind === "customer";
  const listHref = isCustomer ? "/customers" : "/suppliers";
  const singular = isCustomer ? "client" : "fournisseur";
  const endpoint = isCustomer ? "/api/customers" : "/api/suppliers";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const body = {
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      if (mode === "edit" && contact?.id) {
        await apiFetch(`${endpoint}/${contact.id}`, {
          method: "PATCH",
          csrf: true,
          body,
        });
        router.push(listHref);
        router.refresh();
      } else {
        const created = await apiFetch<{ id: string }>(endpoint, {
          method: "POST",
          csrf: true,
          body,
        });
        router.push(isCustomer ? `/customers/${created.id}` : "/suppliers");
        router.refresh();
      }
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "Enregistrement impossible.",
      );
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!contact?.id || deleting) return;
    if (!window.confirm(`Supprimer définitivement ce ${singular} ?`)) return;

    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`${endpoint}/${contact.id}`, {
        method: "DELETE",
        csrf: true,
      });
      router.push(listHref);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "Suppression impossible.",
      );
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormError message={error} />

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[0.9375rem] font-semibold">
            Coordonnées du {singular}
          </h2>
          <p className="mt-0.5 text-[0.75rem] text-muted">
            Seul le nom est obligatoire. Ces informations restent privées à la boutique.
          </p>
        </div>
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Nom" htmlFor="name" className="sm:col-span-2">
            <TextInput
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={160}
              placeholder={isCustomer ? "Aminata Diallo" : "Grossiste Sahel"}
            />
          </Field>
          <Field label="Téléphone" htmlFor="phone" hint="Optionnel">
            <TextInput
              id="phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={40}
              placeholder="+221 77 000 00 00"
            />
          </Field>
          <Field label="E-mail" htmlFor="email" hint="Optionnel">
            <TextInput
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={200}
              placeholder="contact@exemple.com"
            />
          </Field>
          <Field label="Adresse" htmlFor="address" hint="Optionnel" className="sm:col-span-2">
            <TextInput
              id="address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              maxLength={500}
              placeholder="Quartier, ville"
            />
          </Field>
          <Field label="Notes internes" htmlFor="notes" hint="Optionnel" className="sm:col-span-2">
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={1000}
              placeholder={
                isCustomer
                  ? "Préférences de paiement, informations de livraison…"
                  : "Conditions d'achat, délais de livraison…"
              }
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <div>
          {mode === "edit" && contact?.id && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || loading}
              className="rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium text-danger hover:bg-danger-soft disabled:opacity-50"
            >
              {deleting ? "Suppression…" : `Supprimer le ${singular}`}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={listHref}
            className={buttonClasses({ variant: "secondary", size: "md" })}
          >
            Annuler
          </Link>
          <button type="submit" disabled={loading || deleting} className={buttonClasses({ size: "md" })}>
            {loading
              ? "Enregistrement…"
              : mode === "create"
                ? `Créer le ${singular}`
                : "Enregistrer"}
          </button>
        </div>
      </div>
    </form>
  );
}
