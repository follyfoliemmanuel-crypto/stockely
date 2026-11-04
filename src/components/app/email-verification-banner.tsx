"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icons";
import { ApiClientError, apiFetch } from "@/lib/api-client";

type SendState = "idle" | "sending" | "sent";

export function EmailVerificationBanner({ email }: { email: string }) {
  const [state, setState] = useState<SendState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setError(null);
    setState("sending");

    try {
      await apiFetch("/api/auth/verify-email/resend", {
        method: "POST",
        csrf: true,
      });
      setState("sent");
    } catch (caught) {
      setState("idle");
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "L'envoi a échoué. Réessayez dans un instant.",
      );
    }
  }

  return (
    <div
      role="status"
      className="mb-5 flex flex-col gap-3 rounded-2xl border border-accent/25 bg-accent-soft/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-accent-ink">
          <Icon name="send" className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[0.8125rem] font-semibold text-ink">
            Confirmez votre adresse e-mail
          </p>
          <p className="mt-0.5 text-[0.75rem] leading-5 text-muted">
            {state === "sent"
              ? `Un nouvel e-mail vient d'être envoyé à ${email}. Pensez à vérifier les indésirables.`
              : `Un lien de confirmation a été envoyé à ${email}. Confirmez-le pour sécuriser votre compte.`}
          </p>
          {error && (
            <p className="mt-1 text-[0.75rem] font-medium text-danger">{error}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={resend}
        disabled={state === "sending"}
        className="shrink-0 self-start rounded-lg border border-line bg-white px-3 py-2 text-[0.75rem] font-bold text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
      >
        {state === "sending"
          ? "Envoi…"
          : state === "sent"
            ? "Renvoyer"
            : "Renvoyer l'e-mail"}
      </button>
    </div>
  );
}
