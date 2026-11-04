"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ApiClientError, apiFetch } from "@/lib/api-client";

type Status = "loading" | "success" | "error" | "missing";

function readTokenFromHash(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = params.get("token");
  if (!token || token.length > 1_024) return null;
  return token;
}

function clearTokenFromUrl(): void {
  window.history.replaceState(null, "", window.location.pathname);
}

export function VerifyEmailStatus() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState(
    "Confirmation de votre adresse e-mail en cours…",
  );
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = readTokenFromHash();
    if (!token) {
      setStatus("missing");
      setMessage(
        "Ce lien ne contient pas de jeton valide. Demandez un nouvel e-mail depuis votre tableau de bord.",
      );
      return;
    }

    clearTokenFromUrl();

    apiFetch("/api/auth/verify-email", {
      method: "POST",
      body: { token },
    })
      .then(() => {
        setStatus("success");
        setMessage(
          "Votre adresse e-mail est confirmée. Votre compte est maintenant sécurisé.",
        );
      })
      .catch((caught) => {
        setStatus("error");
        setMessage(
          caught instanceof ApiClientError
            ? caught.message
            : "La vérification a échoué. Réessayez depuis votre tableau de bord.",
        );
      });
  }, []);

  if (status === "loading") {
    return (
      <p className="text-[0.875rem] leading-6 text-muted" role="status">
        {message}
      </p>
    );
  }

  if (status === "success") {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">
          Adresse confirmée
        </h1>
        <p className="mt-3 text-[0.875rem] leading-6 text-muted">{message}</p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-primary-dark px-4 text-sm font-medium text-white transition-colors hover:bg-[#166534]"
        >
          Accéder à mon espace
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.025em]">
        Vérification impossible
      </h1>
      <p className="mt-3 text-[0.875rem] leading-6 text-muted">{message}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary-dark px-4 text-sm font-medium text-white transition-colors hover:bg-[#166534]"
        >
          Mon tableau de bord
        </Link>
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-md border border-line px-4 text-sm font-medium text-ink transition-colors hover:bg-surface"
        >
          Se connecter
        </Link>
      </div>
    </div>
  );
}
