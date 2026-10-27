import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-line/90 bg-white p-6 shadow-card sm:p-9">
        <Logo />
        <p className="mt-8 flex items-center gap-2 text-[0.625rem] font-bold uppercase tracking-[0.18em] text-muted">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-strong" />
          Erreur 404
        </p>
        <h1 className="mt-2 text-[2rem] font-extrabold leading-[1.08] tracking-[-0.05em]">
          Cette page est introuvable.
        </h1>
        <p className="mt-2 max-w-md text-[0.875rem] leading-6 text-muted">
          Le lien a peut-être changé, ou la ressource n&apos;existe plus dans cette
          boutique. Revenez au tableau de bord pour reprendre votre travail.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link href="/dashboard" className={buttonClasses({ size: "sm" })}>
            Tableau de bord
          </Link>
          <Link
            href="/products"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Voir les produits
          </Link>
        </div>
      </div>
    </main>
  );
}
