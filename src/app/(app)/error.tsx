"use client";

import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-lg rounded-2xl border border-line/90 bg-white p-6 shadow-card sm:p-8">
        <p className="flex items-center gap-2 text-[0.625rem] font-bold uppercase tracking-[0.18em] text-muted">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-danger" />
          Erreur inattendue
        </p>
        <h1 className="mt-2 text-[1.6rem] font-extrabold tracking-[-0.04em]">
          Cette page n&apos;a pas pu être chargée.
        </h1>
        <p className="mt-2 text-[0.875rem] leading-6 text-muted">
          Vos données n&apos;ont pas été modifiées. Réessayez dans un instant. Si
          le problème persiste, contactez l&apos;administrateur de la boutique.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={reset} className={buttonClasses({ size: "sm" })}>
            Réessayer
          </button>
          <Link
            href="/dashboard"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}
