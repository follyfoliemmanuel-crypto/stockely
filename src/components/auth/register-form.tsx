"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormError, Select, TextInput } from "@/components/ui/field";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { ApiClientError, apiFetch } from "@/lib/api-client";

const CURRENCIES = [
  { code: "XOF", label: "FCFA — Franc CFA (XOF)" },
  { code: "XAF", label: "FCFA — Franc CFA (XAF)" },
  { code: "GHS", label: "Cedi ghanéen (GHS)" },
  { code: "NGN", label: "Naira nigérian (NGN)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "USD", label: "Dollar américain (USD)" },
  { code: "MAD", label: "Dirham marocain (MAD)" },
];

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError("Le mot de passe doit contenir au moins 10 caractères.");
      return;
    }

    setLoading(true);

    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        body: { name, shopName, email, password, currency },
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Création impossible. Réessayez.",
      );
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.025em]">Créer mon espace stock</h1>
      <p className="mt-2 text-[0.875rem] leading-6 text-muted">
        Votre espace de gestion est prêt immédiatement. Vous en êtes le propriétaire.
      </p>

      <div className="mt-6">
        <GoogleButton label="S'inscrire avec Google" />
      </div>

      <div className="my-6">
        <AuthDivider label="ou avec un e-mail" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormError message={error} />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Votre nom" htmlFor="name">
            <TextInput
              id="name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              placeholder="Awa Diallo"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field label="Nom de la boutique" htmlFor="shopName">
            <TextInput
              id="shopName"
              name="shopName"
              autoComplete="organization"
              required
              minLength={2}
              placeholder="Maison Lumen"
              value={shopName}
              onChange={(event) => setShopName(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Adresse e-mail" htmlFor="email">
          <TextInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="vous@boutique.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field
          label="Mot de passe"
          htmlFor="password"
          hint="10 caractères minimum"
        >
          <TextInput
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            placeholder="Choisissez un mot de passe solide"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Field label="Devise de la boutique" htmlFor="currency" hint="Modifiable plus tard">
          <Select
            id="currency"
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            {CURRENCIES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Créer mon espace
        </Button>

        <p className="text-[0.75rem] leading-5 text-muted">
          En créant un compte, vous acceptez que vos données soient conservées pour
          le fonctionnement de votre boutique. Aucun paiement n&apos;est demandé.
        </p>
      </form>

      <p className="mt-6 border-t border-line pt-6 text-[0.8125rem] text-muted">
        Vous avez déjà un compte ?{" "}
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
