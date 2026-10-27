"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormError, FormSuccess, TextInput } from "@/components/ui/field";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export function WarehouseCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch<{ warehouse: { id: string } | null }>("/api/warehouses", {
        method: "POST",
        csrf: true,
        body: {
          name: name.trim(),
          code: code.trim(),
          address: address.trim() || null,
          isDefault,
        },
      });
      setName("");
      setCode("");
      setAddress("");
      setIsDefault(false);
      setSuccess("Entrepôt créé.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Création de l'entrepôt impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" htmlFor="warehouse-name">
          <TextInput
            id="warehouse-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            required
            placeholder="Dépôt central"
          />
        </Field>
        <Field label="Code" htmlFor="warehouse-code" hint="2 à 32 caractères">
          <TextInput
            id="warehouse-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={32}
            required
            placeholder="MAIN"
            className="font-mono uppercase"
          />
        </Field>
      </div>

      <Field label="Adresse" htmlFor="warehouse-address" hint="Facultatif">
        <TextInput
          id="warehouse-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          maxLength={500}
          placeholder="Quartier, ville"
        />
      </Field>

      <label className="flex items-center gap-2 text-[0.8125rem] text-ink">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(event) => setIsDefault(event.target.checked)}
          className="h-4 w-4 rounded border-line-strong text-primary focus:ring-primary/20"
        />
        Définir comme entrepôt par défaut
      </label>

      <FormError message={error} />
      <FormSuccess message={success} />

      <Button type="submit" size="sm" loading={loading}>
        Créer l&apos;entrepôt
      </Button>
    </form>
  );
}
