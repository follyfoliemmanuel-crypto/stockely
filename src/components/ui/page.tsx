import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="flex items-center gap-2 text-[0.625rem] font-bold uppercase tracking-[0.18em] text-muted">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-strong" />
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 text-balance text-[1.9rem] font-extrabold leading-[1.1] tracking-[-0.05em] sm:text-[2.25rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[0.875rem] leading-6 text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-line/90 bg-white shadow-card",
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5">
          <div>
            {title && (
              <h2 className="text-[0.9375rem] font-bold tracking-[-0.02em]">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-[0.75rem] leading-5 text-muted">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  body,
  action,
  compact = false,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start justify-center rounded-xl border border-dashed border-line-strong/70 bg-surface px-4",
        compact ? "min-h-[7rem] py-4" : "min-h-[9rem] py-6",
      )}
    >
      <p className="text-[0.875rem] font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-md text-[0.8125rem] leading-6 text-muted">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    neutral: "bg-surface-strong text-muted",
    success: "bg-primary-soft text-primary-dark",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold",
        tones[tone],
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "success" && "bg-primary",
          tone === "warning" && "bg-warning",
          tone === "danger" && "bg-danger",
          tone === "info" && "bg-info",
          tone === "neutral" && "bg-muted/50",
        )}
      />
      {children}
    </span>
  );
}

export function Pagination({
  page,
  pageCount,
  prevHref,
  nextHref,
}: {
  page: number;
  pageCount: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[0.75rem] text-muted">
      <span className="tabular font-mono">
        Page {page} sur {pageCount}
      </span>
      <div className="flex items-center gap-2">
        {prevHref ? (
          <Link
            href={prevHref}
            className="inline-flex h-8 items-center rounded-full border border-line bg-white px-3 font-semibold text-ink shadow-soft hover:bg-surface"
          >
            Précédent
          </Link>
        ) : (
          <span className="inline-flex h-8 items-center rounded-full border border-line px-3 opacity-50">
            Précédent
          </span>
        )}
        {nextHref ? (
          <Link
            href={nextHref}
            className="inline-flex h-8 items-center rounded-full border border-line bg-white px-3 font-semibold text-ink shadow-soft hover:bg-surface"
          >
            Suivant
          </Link>
        ) : (
          <span className="inline-flex h-8 items-center rounded-full border border-line px-3 opacity-50">
            Suivant
          </span>
        )}
      </div>
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <form
      method="get"
      className="flex flex-col gap-2 border-b border-line/80 bg-surface/70 px-4 py-3 sm:flex-row sm:items-end sm:px-5"
    >
      {children}
    </form>
  );
}
