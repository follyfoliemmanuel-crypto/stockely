import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Logo />

        <nav aria-label="Navigation principale" className="hidden items-center gap-7 md:flex">
          <a
            href="#fonctionnement"
            className="text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
          >
            Fonctionnement
          </a>
          <a
            href="#securite"
            className="text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
          >
            Sécurité
          </a>
          <a
            href="#rapports"
            className="text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
          >
            Rapports
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden rounded-md px-3 py-2 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-surface sm:inline-flex"
          >
            Se connecter
          </Link>
          <Link href="/register" className={buttonClasses({ size: "sm" })}>
            Créer mon espace
          </Link>
        </div>
      </div>
    </header>
  );
}
