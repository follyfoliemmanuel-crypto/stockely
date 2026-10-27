"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormError, FormSuccess, TextInput } from "@/components/ui/field";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export interface EditableWarehouse {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export function WarehouseEditForm({ warehouse }: { warehouse: EditableWarehouse }) {
  const router = useRouter();
  const [name, setName] = useState(warehouse.name);
  const [code, setCode] = useState(warehouse.code);
  const [address, setAddress] = useState(warehouse.address ?? "");
  const [isDefault, setIsDefault] = useState(warehouse.isDefault);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch(`/api/warehouses/${warehouse.id}`, {
        method: "PATCH",
        csrf: true,
        body: {
          name: name.trim(),
          code: code.trim(),
          address: address.trim() || null,
          isDefault,
        },
      });
      setSuccess("Entrepôt mis à jour.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Mise à jour impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive() {
    if (archiving) return;
    if (
      !window.confirm(
        "Archiver cet entrepôt ? Il ne sera plus proposé pour les opérations. L'historique est conservé.",
      )
    ) {
      return;
    }
    setArchiving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch(`/api/warehouses/${warehouse.id}/archive`, {
        method: "POST",
        csrf: true,
        body: { archived: true },
      });
      router.push("/warehouses");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Archivage impossible.",
      );
      setArchiving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" htmlFor="edit-warehouse-name">
          <TextInput
            id="edit-warehouse-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            required
          />
        </Field>
        <Field label="Code" htmlFor="edit-warehouse-code" hint="2 à 32 caractères">
          <TextInput
            id="edit-warehouse-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={32}
            required
            className="font-mono uppercase"
          />
        </Field>
      </div>

      <Field label="Adresse" htmlFor="edit-warehouse-address" hint="Facultatif">
        <TextInput
          id="edit-warehouse-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          maxLength={500}
        />
      </Field>

      <label className="flex items-center gap-2 text-[0.8125rem] text-ink">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(event) => setIsDefault(event.target.checked)}
          className="h-4 w-4 rounded border-line-strong text-primary focus:ring-primary/20"
        />
        Entrepôt par défaut
      </label>

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" loading={loading}>
          Enregistrer
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          loading={archiving}
          onClick={handleArchive}
        >
          Archiver
        </Button>
      </div>
    </form>
  );
}
