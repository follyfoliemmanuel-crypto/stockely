"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormError, TextInput } from "@/components/ui/field";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError("Le mot de passe doit contenir au moins 10 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/auth/password/reset", {
        method: "POST",
        body: { token, password },
      });
      setSuccess(true);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "La réinitialisation a échoué. Réessayez.",
      );
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">Mot de passe modifié</h1>
        <p className="mt-3 text-[0.875rem] leading-6 text-muted">
          Votre nouveau mot de passe est actif. Pour votre sécurité, toutes les
          sessions ouvertes ont été fermées.
        </p>
        <Link
          href="/login?reset=1"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-primary-dark px-4 text-sm font-medium text-white transition-colors hover:bg-[#166534]"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.025em]">
        Choisir un nouveau mot de passe
      </h1>
      <p className="mt-2 text-[0.875rem] leading-6 text-muted">
        Dix caractères minimum. Évitez un mot de passe déjà utilisé ailleurs.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        <FormError message={error} />

        <Field label="Nouveau mot de passe" htmlFor="password" hint="10 caractères minimum">
          <TextInput
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            autoFocus
            placeholder="Choisissez un mot de passe solide"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Field label="Confirmer le mot de passe" htmlFor="confirm">
          <TextInput
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            placeholder="Répétez le mot de passe"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Enregistrer le mot de passe
        </Button>
      </form>

      <p className="mt-6 border-t border-line pt-6 text-[0.8125rem] text-muted">
        Lien expiré ?{" "}
        <Link
          href="/forgot-password"
          className="font-medium text-primary-dark underline-offset-4 hover:underline"
        >
          Demander un nouveau lien
        </Link>
      </p>
    </div>
  );
}
