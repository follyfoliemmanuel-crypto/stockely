"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormError, FormSuccess } from "@/components/ui/field";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { roleLabel } from "@/server/permissions";
import type { MemberRole } from "@/server/db/schema";

export interface AccessMember {
  membershipId: string;
  name: string;
  email: string;
  role: MemberRole;
  hasAccess: boolean;
  hasAllAccess: boolean;
}

export function WarehouseAccessForm({
  warehouseId,
  members,
}: {
  warehouseId: string;
  members: AccessMember[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(
    () =>
      new Set(
        members
          .filter((member) => member.hasAccess || member.hasAllAccess)
          .map((member) => member.membershipId),
      ),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function toggle(membershipId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(membershipId)) next.delete(membershipId);
      else next.add(membershipId);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch(`/api/warehouses/${warehouseId}/access`, {
        method: "PUT",
        csrf: true,
        body: { membershipIds: [...selected] },
      });
      setSuccess("Accès enregistrés.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Enregistrement des accès impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (members.length === 0) {
    return (
      <p className="px-5 py-4 text-[0.8125rem] text-muted">
        Aucun membre dans cette boutique.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
      <p className="text-[0.75rem] text-muted">
        Les propriétaires, administrateurs et gestionnaires de stock accèdent
        toujours à tous les entrepôts. Cochez les autres membres autorisés.
      </p>

      <ul className="divide-y divide-line rounded-md border border-line">
        {members.map((member) => (
          <li key={member.membershipId}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={selected.has(member.membershipId)}
                disabled={member.hasAllAccess}
                onChange={() => toggle(member.membershipId)}
                className="h-4 w-4 rounded border-line-strong text-primary focus:ring-primary/20 disabled:opacity-60"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-medium">
                  {member.name}
                </span>
                <span className="block truncate text-[0.6875rem] text-muted">
                  {member.email}
                </span>
              </span>
              <span className="shrink-0 rounded-full border border-line bg-surface px-2 py-0.5 text-[0.625rem] font-medium text-muted">
                {roleLabel(member.role)}
                {member.hasAllAccess ? " · tous" : ""}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <FormError message={error} />
      <FormSuccess message={success} />

      <Button type="submit" size="sm" loading={loading}>
        Enregistrer les accès
      </Button>
    </form>
  );
}
