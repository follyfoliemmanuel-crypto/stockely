import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/cn";

const markSizes = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
} as const;

const lockupSizes = {
  sm: "h-5",
  md: "h-7",
  lg: "h-8",
} as const;

/**
 * Marque seule (pastille verte) : en-têtes compacts, aperçus.
 * Le fichier source est un PNG 512×512 dérivé du logo fourni.
 */
export function LogoMark({
  size = "md",
  className,
}: {
  size?: keyof typeof markSizes;
  className?: string;
}) {
  return (
    <Image
      src="/brand/stockely-mark.png"
      alt="Stockely"
      width={512}
      height={512}
      sizes="48px"
      loading="eager"
      className={cn(markSizes[size], className)}
    />
  );
}

/**
 * Logo horizontal complet : pastille + mot-symbole.
 * `tone="light"` sert le mot-symbole blanc pour les fonds sombres.
 */
export function LogoLockup({
  tone = "dark",
  size = "lg",
  loading = "lazy",
  className,
}: {
  tone?: "dark" | "light";
  size?: keyof typeof lockupSizes;
  loading?: "eager" | "lazy";
  className?: string;
}) {
  return (
    <Image
      src={
        tone === "light"
          ? "/brand/stockely-logo-white.png"
          : "/brand/stockely-logo.png"
      }
      alt="Stockely"
      width={1411}
      height={300}
      sizes="220px"
      loading={loading}
      className={cn(lockupSizes[size], "w-auto", className)}
    />
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
        "inline-flex items-center rounded-md focus-visible:outline-offset-4",
        className,
      )}
    >
      {compact ? <LogoMark size="md" /> : <LogoLockup loading="eager" />}
    </Link>
  );
}
