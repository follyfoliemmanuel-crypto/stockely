"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { buttonClasses } from "@/components/ui/button";
import { Field, FormError, TextInput, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { EmptyState, StatusPill } from "@/components/ui/page";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  productCount: number;
}

export function CategoryManager({
  categories,
  canWrite,
}: {
  categories: CategoryRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setError(null);
    setOpen(true);
  }

  function openEdit(category: CategoryRow) {
    setEditing(category);
    setName(category.name);
    setDescription(category.description ?? "");
    setError(null);
    setOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      if (editing) {
        await apiFetch(`/api/categories/${editing.id}`, {
          method: "PATCH",
          csrf: true,
          body: { name: name.trim(), description: description.trim() || null },
        });
      } else {
        await apiFetch("/api/categories", {
          method: "POST",
          csrf: true,
          body: { name: name.trim(), description: description.trim() || null },
        });
      }
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "Enregistrement impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(category: CategoryRow) {
    if (deletingId) return;
    const message =
      category.productCount > 0
        ? `Supprimer « ${category.name} » ? ${category.productCount} produit(s) seront conservés sans catégorie.`
        : `Supprimer « ${category.name} » ?`;
    if (!window.confirm(message)) return;

    setDeletingId(category.id);
    setError(null);
    try {
      await apiFetch(`/api/categories/${category.id}`, {
        method: "DELETE",
        csrf: true,
      });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "Suppression impossible.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <FormError message={error && !open ? error : null} />

      <section className="overflow-hidden rounded-lg border border-line bg-white">
        {categories.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Aucune catégorie"
              body="Regroupez vos produits par famille pour filtrer le catalogue et analyser les ventes."
              action={
                canWrite ? (
                  <button type="button" onClick={openCreate} className={buttonClasses({ size: "sm" })}>
                    Créer une catégorie
                  </button>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line text-[0.625rem] uppercase tracking-[0.12em] text-muted">
                  <th className="px-5 py-2.5 font-semibold">Catégorie</th>
                  <th className="px-4 py-2.5 font-semibold">Description</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Produits</th>
                  {canWrite && <th className="px-5 py-2.5 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {categories.map((category) => (
                  <tr key={category.id} className="transition-colors hover:bg-surface/60">
                    <td className="px-5 py-3 font-medium">{category.name}</td>
                    <td className="max-w-md px-4 py-3 text-muted">
                      {category.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusPill tone={category.productCount > 0 ? "success" : "neutral"}>
                        {category.productCount} produit{category.productCount > 1 ? "s" : ""}
                      </StatusPill>
                    </td>
                    {canWrite && (
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(category)}
                            className="rounded-md px-2 py-1 text-[0.75rem] font-medium text-muted hover:bg-surface hover:text-ink"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(category)}
                            disabled={deletingId === category.id}
                            className="rounded-md px-2 py-1 text-[0.75rem] font-medium text-danger hover:bg-danger-soft disabled:opacity-50"
                          >
                            {deletingId === category.id ? "…" : "Supprimer"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canWrite && categories.length > 0 && (
        <div className="flex justify-end">
          <button type="button" onClick={openCreate} className={buttonClasses({ size: "sm" })}>
            Nouvelle catégorie
          </button>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Modifier la catégorie" : "Nouvelle catégorie"}
        description="Une catégorie regroupe des produits dans le catalogue et les rapports."
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormError message={error} />
          <Field label="Nom" htmlFor="category-name">
            <TextInput
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
              autoFocus
              placeholder="Épicerie"
            />
          </Field>
          <Field label="Description" htmlFor="category-description" hint="Optionnel">
            <Textarea
              id="category-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              className="min-h-20"
              placeholder="Produits secs, conserves, condiments…"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Annuler
            </button>
            <button type="submit" disabled={loading} className={buttonClasses({ size: "sm" })}>
              {loading ? "Enregistrement…" : editing ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
