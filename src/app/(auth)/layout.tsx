import Link from "next/link";

import { Logo, LogoMark } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <aside className="hidden border-r border-line bg-surface lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Logo />

        <div className="max-w-md">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary-dark">
            Votre commerce, sous contrôle
          </p>
          <h2 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-[-0.03em]">
            Un espace par boutique. Un rôle par personne.
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-7 text-muted">
            Chaque membre accède uniquement à ce que son rôle autorise. Les
            opérations sensibles sont vérifiées côté serveur et conservées dans le
            journal d&apos;audit.
          </p>

          <ul className="mt-8 space-y-4 border-t border-line pt-6">
            {[
              {
                title: "Stock tracé",
                body: "Chaque entrée, sortie et correction laisse un mouvement lisible.",
              },
              {
                title: "Ventes fiables",
                body: "Prix recalculés, stock vérifié, double vente bloquée.",
              },
              {
                title: "Rapports honnêtes",
                body: "Chiffre d'affaires, coûts et marge sont distingués.",
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                />
                <div>
                  <p className="text-[0.875rem] font-medium">{item.title}</p>
                  <p className="mt-0.5 text-[0.8125rem] leading-6 text-muted">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[0.75rem] text-muted">
          Données isolées par boutique · Sessions sécurisées · Journal d&apos;audit
        </p>
      </aside>

      <main className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-4 lg:hidden">
          <Logo />
          <Link
            href="/"
            className="text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
          >
            Accueil
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
          <div className="w-full max-w-[26rem]">
            <div className="mb-8 hidden items-center gap-3 lg:flex">
              <LogoMark className="h-10 w-10" />
              <div>
                <p className="text-[0.9375rem] font-semibold">Stockely</p>
                <p className="text-[0.75rem] text-muted">Gestion de stock &amp; ventes</p>
              </div>
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
