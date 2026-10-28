"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormError, TextInput } from "@/components/ui/field";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { ApiClientError, apiFetch } from "@/lib/api-client";

export function LoginForm({
  initialError = null,
  notice = null,
}: {
  initialError?: string | null;
  notice?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Connexion impossible. Réessayez.",
      );
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.025em]">Connexion</h1>
      <p className="mt-2 text-[0.875rem] leading-6 text-muted">
        Accédez à l&apos;espace de votre boutique.
      </p>

      {notice && (
        <div
          role="status"
          className="mt-5 rounded-md border border-green-200 bg-primary-soft px-3.5 py-3 text-[0.8125rem] text-primary-dark"
        >
          {notice}
        </div>
      )}

      <div className="mt-6">
        <GoogleButton />
      </div>

      <div className="my-6">
        <AuthDivider label="ou avec un e-mail" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
            aria-invalid={error ? true : undefined}
          />
        </Field>

        <Field label="Mot de passe" htmlFor="password">
          <div className="relative">
            <TextInput
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="Votre mot de passe"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 rounded-r-md px-3 text-[0.75rem] font-medium text-muted transition-colors hover:text-ink"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? "Masquer" : "Afficher"}
            </button>
          </div>
        </Field>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-[0.75rem] font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Se connecter
        </Button>
      </form>

      <p className="mt-6 border-t border-line pt-6 text-[0.8125rem] text-muted">
        Pas encore de compte ?{" "}
        <Link
          href="/register"
          className="font-medium text-primary-dark underline-offset-4 hover:underline"
        >
          Créer mon espace
        </Link>
      </p>
    </div>
  );
}
