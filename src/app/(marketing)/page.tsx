import Link from "next/link";

import { PublicFooter } from "@/components/marketing/public-footer";
import { PublicHeader } from "@/components/marketing/public-header";
import { LogoMark } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn("h-4 w-4", className)}
    >
      <path
        d="M4.5 10.5l3.2 3.2 7.8-7.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M4 10h11m0 0-4.2-4.2M15 10l-4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const steps = [
  {
    number: "01",
    title: "Réceptionner",
    body: "Enregistrez une entrée fournisseur. Le stock, le coût d'achat et le journal d'audit sont mis à jour dans la même transaction.",
  },
  {
    number: "02",
    title: "Vendre",
    body: "Recherchez, encaissez, imprimez. Le serveur recalcule les prix, vérifie la disponibilité et empêche la double vente.",
  },
  {
    number: "03",
    title: "Piloter",
    body: "Suivez la valeur du stock, les ruptures et la marge réelle. Exportez les chiffres qui comptent, en PDF ou en CSV.",
  },
];

const securityPoints = [
  {
    title: "Isolation par boutique",
    body: "Chaque requête est filtrée à partir de l'adhésion liée à la session. Un identifiant de boutique envoyé par le navigateur n'est jamais pris pour argent comptant.",
  },
  {
    title: "Transactions atomiques",
    body: "Une vente, ses lignes, son paiement et ses mouvements de stock sont écrits ensemble — ou pas du tout.",
  },
  {
    title: "Permissions vérifiées côté serveur",
    body: "Propriétaire, administrateur, gestionnaire de stock, caissier, consultation : chaque action est contrôlée avant d'atteindre la base.",
  },
  {
    title: "Journal d'audit protégé",
    body: "Les entrées sensibles ne peuvent être ni modifiées ni supprimées depuis l'application. La trace reste.",
  },
];

export default function HomePage() {
  return (
    <>
      <PublicHeader />

      <main id="contenu">
        {/* Hero */}
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-6xl gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-24">
            <div className="animate-rise">
              <p className="inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary-dark">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
                Gestion de stock &amp; ventes
              </p>

              <h1 className="mt-5 max-w-xl text-balance text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-5xl lg:text-[3.6rem]">
                Votre stock, votre commerce,{" "}
                <span className="text-primary-dark">sous contrôle.</span>
              </h1>

              <p className="mt-6 max-w-xl text-[1.0625rem] leading-7 text-muted">
                Stockely réunit l&apos;inventaire, la caisse et les rapports dans un
                seul espace. Chaque mouvement est tracé, chaque vente est vérifiée
                avant d&apos;être enregistrée.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className={buttonClasses({ size: "lg" })}>
                  Créer ma boutique
                  <ArrowIcon />
                </Link>
                <a
                  href="#fonctionnement"
                  className={buttonClasses({ variant: "secondary", size: "lg" })}
                >
                  Voir le fonctionnement
                </a>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[0.8125rem] text-muted">
                {[
                  "Sans installation",
                  "Données isolées par boutique",
                  "Export PDF & CSV",
                ].map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <CheckIcon className="h-3.5 w-3.5 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Aperçu d'interface */}
            <figure className="relative">
              <div
                aria-hidden="true"
                className="absolute -bottom-3 left-6 right-6 h-full rounded-xl border border-primary/15 bg-primary-soft/50"
              />
              <div className="relative overflow-hidden rounded-xl border border-line bg-white shadow-float">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <LogoMark className="h-6 w-6" />
                    <span className="text-[0.8125rem] font-semibold">Stockely</span>
                    <span className="text-[0.75rem] text-muted">/ Accueil</span>
                  </div>
                  <span className="rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-muted">
                    Aperçu
                  </span>
                </div>

                <div className="space-y-5 p-4 sm:p-5">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted">
                        Mouvements récents
                      </p>
                      <p className="mt-1 text-lg font-semibold tracking-tight">
                        Maison Lumen
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
                        Aujourd&apos;hui
                      </p>
                      <p className="tabular font-mono text-sm font-medium">24 oct. 2026</p>
                    </div>
                  </div>

                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {[
                      {
                        type: "Réception",
                        product: "Riz parfumé 5 kg",
                        delta: "+24",
                        positive: true,
                      },
                      {
                        type: "Vente",
                        product: "Huile végétale 1 L",
                        delta: "−3",
                        positive: false,
                      },
                      {
                        type: "Ajustement",
                        product: "Savon de coco",
                        delta: "−1",
                        positive: false,
                      },
                    ].map((row) => (
                      <li
                        key={row.product}
                        className="flex items-center justify-between gap-4 px-3.5 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[0.8125rem] font-medium text-ink">
                            {row.product}
                          </p>
                          <p className="mt-0.5 text-[0.6875rem] uppercase tracking-[0.1em] text-muted">
                            {row.type}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "tabular font-mono text-sm font-medium",
                            row.positive ? "text-primary-dark" : "text-ink",
                          )}
                        >
                          {row.delta}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-line bg-surface px-3.5 py-3">
                      <p className="text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
                        Stock faible
                      </p>
                      <p className="tabular mt-1 font-mono text-lg font-medium">2 produits</p>
                    </div>
                    <div className="rounded-lg border border-line bg-surface px-3.5 py-3">
                      <p className="text-[0.6875rem] uppercase tracking-[0.12em] text-muted">
                        Ruptures
                      </p>
                      <p className="tabular mt-1 flex items-center gap-2 font-mono text-lg font-medium">
                        0
                        <span className="inline-flex items-center gap-1 font-sans text-[0.6875rem] font-medium text-primary-dark">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          à jour
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-line bg-surface px-4 py-2.5">
                  <p className="text-[0.6875rem] text-muted">
                    Illustration de l&apos;interface — données de démonstration.
                  </p>
                </div>
              </div>
            </figure>
          </div>
        </section>

        {/* Fonctionnement */}
        <section id="fonctionnement" className="scroll-mt-20 border-b border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary-dark">
                Fonctionnement
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
                Trois gestes, une seule source de vérité.
              </h2>
              <p className="mt-4 text-[0.9375rem] leading-7 text-muted">
                Pas de tableur parallèle, pas de stock corrigé à la main. Chaque
                opération laisse une trace et met à jour les bons chiffres.
              </p>
            </div>

            <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.number} className="bg-white p-6 sm:p-7">
                  <span className="tabular font-mono text-[0.75rem] font-medium text-primary-dark">
                    {step.number}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[0.875rem] leading-6 text-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sécurité */}
        <section id="securite" className="scroll-mt-20 border-b border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary-dark">
                Sécurité
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
                Le stock ne se modifie pas à la légère.
              </h2>
              <p className="mt-4 text-[0.9375rem] leading-7 text-muted">
                Les règles métier vivent sur le serveur, pas dans le navigateur.
                Stockely refuse une opération incohérente plutôt que de la corriger
                après coup.
              </p>
              <div className="mt-8 rounded-lg border border-line bg-white p-4">
                <p className="text-[0.75rem] font-medium uppercase tracking-[0.12em] text-muted">
                  Règle appliquée
                </p>
                <p className="mt-2 text-[0.875rem] leading-6 text-ink">
                  Une vente dont le stock est insuffisant est rejetée. Une annulation
                  crée un mouvement compensatoire, jamais une suppression.
                </p>
              </div>
            </div>

            <ul className="divide-y divide-line border-y border-line">
              {securityPoints.map((point, index) => (
                <li key={point.title} className="flex gap-4 py-5">
                  <span className="tabular mt-0.5 font-mono text-[0.75rem] text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-[0.9375rem] font-semibold">{point.title}</h3>
                    <p className="mt-1.5 text-[0.875rem] leading-6 text-muted">
                      {point.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Rapports */}
        <section id="rapports" className="scroll-mt-20 border-b border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary-dark">
                Rapports
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
                Des chiffres qui distinguent le revenu du bénéfice.
              </h2>
              <p className="mt-4 text-[0.9375rem] leading-7 text-muted">
                Stockely calcule le chiffre d&apos;affaires, le coût des marchandises
                vendues et la marge à partir des prix figés au moment de chaque vente.
                Le bénéfice n&apos;est affiché que lorsque les coûts sont disponibles.
              </p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {[
                  "Ventes par période",
                  "Produits les plus vendus",
                  "Valeur du stock",
                  "Produits en rupture",
                  "Entrées et sorties",
                  "Achats fournisseurs",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-[0.875rem] text-ink"
                  >
                    <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-line bg-white p-4 shadow-float sm:p-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <p className="text-[0.8125rem] font-semibold">Rapport hebdomadaire</p>
                <span className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-muted">
                  PDF
                </span>
              </div>
              <dl className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-4 text-[0.8125rem]">
                  <dt className="text-muted">Chiffre d&apos;affaires</dt>
                  <dd className="tabular font-mono">1 248 500 FCFA</dd>
                </div>
                <div className="flex items-center justify-between gap-4 text-[0.8125rem]">
                  <dt className="text-muted">Coût des marchandises</dt>
                  <dd className="tabular font-mono">812 200 FCFA</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-line pt-3 text-[0.8125rem]">
                  <dt className="font-medium text-ink">Marge brute</dt>
                  <dd className="tabular font-mono font-medium text-primary-dark">
                    436 300 FCFA
                  </dd>
                </div>
              </dl>
              <div className="mt-4 space-y-2">
                {[
                  { label: "Ventes", width: "82%" },
                  { label: "Coûts", width: "54%" },
                ].map((bar) => (
                  <div key={bar.label} className="space-y-1">
                    <div className="flex justify-between text-[0.6875rem] text-muted">
                      <span>{bar.label}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-strong">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: bar.width }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 border-t border-line pt-3 text-[0.6875rem] text-muted">
                Exemple de rapport — les montants réels proviennent de votre base.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-primary-dark">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Ouvrez votre boutique en quelques minutes.
              </h2>
              <p className="mt-2 text-[0.9375rem] text-white">
                Aucune installation. Vos données restent isolées, votre historique
                reste lisible.
              </p>
            </div>
            <Link
              href="/register"
              className={buttonClasses({
                variant: "secondary",
                size: "lg",
                className: "shrink-0 border-transparent bg-white text-primary-dark hover:bg-primary-soft",
              })}
            >
              Créer ma boutique
              <ArrowIcon />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}
