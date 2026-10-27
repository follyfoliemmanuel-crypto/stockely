import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary-dark text-white border border-primary-dark shadow-soft hover:bg-primary hover:border-primary",
  secondary:
    "bg-white text-ink border border-line-strong hover:border-ink/30 hover:bg-surface",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-surface",
  danger:
    "bg-danger text-white border border-danger shadow-soft hover:bg-[#aa4634] hover:border-[#aa4634]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[0.8125rem]",
  md: "h-10 px-4 text-[0.8125rem]",
  lg: "h-11 px-5 text-sm",
};

export function buttonClasses(options?: {
  variant?: Variant;
  size?: Size;
  className?: string;
}): string {
  const { variant = "primary", size = "md", className } = options ?? {};
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-[-0.01em] transition-colors duration-150",
    "disabled:cursor-not-allowed disabled:opacity-55",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant,
  size,
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
