import Link from "next/link";

import { Logo } from "@/components/brand/logo";

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-sm space-y-3">
          <Logo />
          <p className="text-[0.8125rem] leading-6 text-muted">
            Votre stock, votre commerce, sous contrôle. Inventaire, caisse et
            rapports réunis dans un même espace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[0.8125rem]">
          <Link href="/login" className="text-muted transition-colors hover:text-ink">
            Se connecter
          </Link>
          <Link href="/register" className="text-muted transition-colors hover:text-ink">
            Créer mon espace
          </Link>
          <a href="#securite" className="text-muted transition-colors hover:text-ink">
            Sécurité
          </a>
          <span className="tabular text-muted">
            © {new Date().getFullYear()} Stockely
          </span>
        </div>
      </div>
    </footer>
  );
}
