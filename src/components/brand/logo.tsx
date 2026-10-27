import Link from "next/link";

import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Stockely"
      className={cn("h-8 w-8", className)}
    >
      <rect x="2" y="2" width="28" height="28" rx="9" fill="#E9D66B" />
      <path
        d="M10 11h12M10 16h12M10 21h7"
        stroke="#1F5C43"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <circle cx="23" cy="21" r="2.5" fill="#2E7D5B" />
    </svg>
  );
}

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="Stockely — accueil"
      className={cn(
        "inline-flex items-center gap-2.5 rounded-md focus-visible:outline-offset-4",
        className,
      )}
    >
      <LogoMark />
      {!compact && (
        <span className="text-[1.125rem] font-bold tracking-[-0.035em] text-ink">
          Stockely
        </span>
      )}
    </Link>
  );
}
