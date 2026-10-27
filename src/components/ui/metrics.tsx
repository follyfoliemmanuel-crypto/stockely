import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icons";

/* -------------------------------------------------------------------------- */
/* Indicateurs                                                                */
/* -------------------------------------------------------------------------- */

type MetricTone = "primary" | "accent" | "danger" | "info" | "neutral";

const iconTones: Record<MetricTone, string> = {
  primary: "bg-primary-soft text-primary-dark",
  accent: "bg-accent-soft text-accent-ink",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-strong text-muted",
};

export function TrendBadge({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-1 text-[0.6875rem] font-semibold text-accent-ink">
        Nouveau <span className="font-medium opacity-70">{label}</span>
      </span>
    );
  }

  const positive = value >= 0;
  const rounded = Math.round(Math.abs(value) * 10) / 10;
  const display = rounded > 0 && rounded < 1 ? "< 1 %" : `${rounded} %`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.6875rem] font-semibold",
        positive ? "bg-primary-soft text-primary-dark" : "bg-danger-soft text-danger",
      )}
      aria-label={`${positive ? "Hausse" : "Baisse"} de ${display} ${label}`}
    >
      <Icon name={positive ? "trend-up" : "trend-down"} className="h-3.5 w-3.5" />
      <span>{positive ? "+" : "−"}{display}</span>
      <span className="font-medium opacity-70">{label}</span>
    </span>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = "primary",
  trend,
  footer,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  icon: IconName;
  tone?: MetricTone;
  trend?: { value: number | null; label: string };
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line/90 bg-white p-5 shadow-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-muted">
          {label}
        </p>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            iconTones[tone],
          )}
        >
          <Icon name={icon} className="h-[1.125rem] w-[1.125rem]" />
        </span>
      </div>

      <p className="tabular mt-4 text-[1.65rem] font-extrabold leading-none tracking-[-0.055em] text-ink sm:text-[1.8rem]">
        {value}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {trend && <TrendBadge value={trend.value} label={trend.label} />}
        <p className="text-[0.75rem] leading-5 text-muted">{hint}</p>
      </div>

      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Avatars                                                                    */
/* -------------------------------------------------------------------------- */

const avatarTones = [
  "bg-primary-soft text-primary-dark",
  "bg-accent-soft text-accent-ink",
  "bg-danger-soft text-danger",
  "bg-info-soft text-info",
  "bg-surface-strong text-muted",
];

const avatarSizes = {
  xs: "h-7 w-7 text-[0.625rem]",
  sm: "h-8 w-8 text-[0.6875rem]",
  md: "h-10 w-10 text-[0.75rem]",
  lg: "h-12 w-12 text-[0.875rem]",
};

export function initialsFromName(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof avatarSizes;
  className?: string;
}) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-[-0.02em]",
        avatarSizes[size],
        avatarTones[hash % avatarTones.length],
        className,
      )}
    >
      {initialsFromName(name)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Graphiques                                                                 */
/* -------------------------------------------------------------------------- */

export function ProgressBar({
  value,
  tone = "primary",
  className,
  label,
}: {
  value: number;
  tone?: "primary" | "accent" | "danger";
  className?: string;
  label?: string;
}) {
  const width = Math.max(0, Math.min(100, value));
  const color =
    tone === "accent" ? "bg-accent-strong" : tone === "danger" ? "bg-danger" : "bg-primary";

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-strong", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", color)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 168,
  className,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
  className?: string;
}) {
  const visible = segments.filter((segment) => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);

  let cursor = 0;
  const stops = visible.map((segment) => {
    const start = (cursor / total) * 100;
    cursor += segment.value;
    const end = (cursor / total) * 100;
    return `${segment.color} ${start}% ${end}%`;
  });

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        total > 0
          ? `${centerLabel} : ${visible
              .map((segment) => `${segment.label} ${segment.value}`)
              .join(", ")}`
          : `${centerLabel} : aucune donnée`
      }
    >
      <div
        className="h-full w-full rounded-full"
        style={{
          background:
            total > 0
              ? `conic-gradient(${stops.join(", ")})`
              : "var(--color-surface-strong)",
        }}
      />
      <div className="absolute inset-[19%] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-[inset_0_0_0_1px_rgb(229_229_218/0.9)]">
        <span className="tabular text-[1.05rem] font-extrabold tracking-[-0.04em] text-ink">
          {centerValue}
        </span>
        <span className="mt-0.5 max-w-[7rem] text-[0.625rem] font-medium leading-4 text-muted">
          {centerLabel}
        </span>
      </div>
    </div>
  );
}

export interface AreaPoint {
  label: string;
  value: number;
  tooltip?: string;
}

export function SalesAreaChart({
  data,
  formatValue,
  ariaLabel,
  emptyLabel = "Aucune vente sur la période.",
}: {
  data: AreaPoint[];
  formatValue: (value: number) => string;
  ariaLabel: string;
  emptyLabel?: string;
}) {
  const width = 640;
  const height = 200;
  const paddingX = 10;
  const paddingTop = 18;
  const paddingBottom = 18;
  const max = Math.max(1, ...data.map((point) => point.value));
  const total = data.reduce((sum, point) => sum + point.value, 0);

  const points = data.map((point, index) => {
    const x =
      data.length === 1
        ? width / 2
        : paddingX + (index * (width - paddingX * 2)) / (data.length - 1);
    const y =
      height -
      paddingBottom -
      (point.value / max) * (height - paddingTop - paddingBottom);
    return { ...point, x, y };
  });

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const area =
    points.length > 0
      ? `${line} L ${points[points.length - 1]!.x} ${height - paddingBottom} L ${points[0]!.x} ${height - paddingBottom} Z`
      : "";

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="h-auto w-full overflow-visible"
      >
        <title>{ariaLabel}</title>
        <defs>
          <linearGradient id="sales-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2E7D5B" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2E7D5B" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={paddingX}
            x2={width - paddingX}
            y1={paddingTop + (height - paddingTop - paddingBottom) * ratio}
            y2={paddingTop + (height - paddingTop - paddingBottom) * ratio}
            stroke="#E5E5DA"
            strokeWidth="1"
            strokeDasharray="3 5"
          />
        ))}

        {area && <path d={area} fill="url(#sales-area-gradient)" />}
        {line && (
          <path
            d={line}
            fill="none"
            stroke="#2E7D5B"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((point) => (
          <g key={point.label}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4.5"
              fill="#FFFFFF"
              stroke="#2E7D5B"
              strokeWidth="2.5"
            >
              <title>{`${point.label} · ${point.tooltip ?? formatValue(point.value)}`}</title>
            </circle>
          </g>
        ))}
      </svg>

      {total === 0 && (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[0.75rem] font-medium text-muted">
          {emptyLabel}
        </p>
      )}

      <div
        className="mt-1 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, data.length)}, minmax(0, 1fr))` }}
      >
        {data.map((point) => (
          <span
            key={point.label}
            className="truncate text-center text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted"
          >
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
