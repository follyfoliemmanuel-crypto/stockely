"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormError, TextInput } from "@/components/ui/field";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiFetch("/api/auth/password/request", {
        method: "POST",
        body: { email },
      });
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "La demande n'a pas pu être envoyée. Réessayez.",
      );
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">Vérifiez vos e-mails</h1>
        <p className="mt-3 text-[0.875rem] leading-6 text-muted">
          Si un compte correspond à <span className="font-medium text-ink">{email}</span>,
          un lien de réinitialisation vient d&apos;être envoyé. Il est valable une heure
          et ne peut être utilisé qu&apos;une fois.
        </p>
        <p className="mt-3 text-[0.8125rem] leading-6 text-muted">
          Pensez à vérifier le dossier « indésirables ». Le lien peut prendre quelques
          minutes.
        </p>

        <Link
          href="/login"
          className="mt-8 inline-flex text-[0.8125rem] font-medium text-primary-dark underline-offset-4 hover:underline"
        >
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.025em]">Mot de passe oublié</h1>
      <p className="mt-2 text-[0.875rem] leading-6 text-muted">
        Indiquez l&apos;adresse de votre compte. Nous vous enverrons un lien pour
        choisir un nouveau mot de passe.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        <FormError message={error} />

        <Field label="Adresse e-mail" htmlFor="email">
          <TextInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            autoFocus
            placeholder="vous@boutique.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Envoyer le lien
        </Button>
      </form>

      <p className="mt-6 border-t border-line pt-6 text-[0.8125rem] text-muted">
        Vous vous souvenez de votre mot de passe ?{" "}
        <Link
          href="/login"
          className="font-medium text-primary-dark underline-offset-4 hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
