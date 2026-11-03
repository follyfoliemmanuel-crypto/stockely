import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "wallet"
  | "receipt"
  | "boxes"
  | "alert"
  | "users"
  | "user-plus"
  | "chart"
  | "search"
  | "arrow-right"
  | "arrow-up-right"
  | "warehouse"
  | "package"
  | "trend-up"
  | "trend-down"
  | "sparkles"
  | "send";

const paths: Record<IconName, ReactNode> = {
  wallet: (
    <>
      <path d="M3.5 6.5A2.5 2.5 0 0 1 6 4h9.5A1.5 1.5 0 0 1 17 5.5V7" />
      <path d="M3.5 6.5v8A2.5 2.5 0 0 0 6 17h10a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 16 8H5" />
      <path d="M14.5 12.5h.01" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3.5h10v13.8l-2.5-1.5-2.5 1.5-2.5-1.5L5 17.3z" />
      <path d="M7.5 7h5M7.5 10h5M7.5 13h3" />
    </>
  ),
  boxes: (
    <>
      <path d="m10 2.8 6 3.2v7.8l-6 3.4-6-3.4V6z" />
      <path d="M4 6l6 3.2L16 6M10 9.2v8" />
      <path d="M7 4.4 13 7.6" />
    </>
  ),
  alert: (
    <>
      <path d="M10 3.2 17 16H3z" />
      <path d="M10 7.5v4M10 14h.01" />
    </>
  ),
  users: (
    <>
      <path d="M7.2 9.2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M2.5 17a4.7 4.7 0 0 1 9.4 0M13 6.5a2.5 2.5 0 0 1 0 5M14.2 12.6a4.3 4.3 0 0 1 3.3 4.4" />
    </>
  ),
  "user-plus": (
    <>
      <path d="M7.2 9.2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M2.5 17a4.7 4.7 0 0 1 9.4 0M15 8v6M12 11h6" />
    </>
  ),
  chart: (
    <>
      <path d="M3.5 16.5V11m4.3 5.5V6.5m4.4 10v-7m4.3 7v-12" />
    </>
  ),
  search: (
    <>
      <circle cx="8.8" cy="8.8" r="4.8" />
      <path d="m12.4 12.4 4.1 4.1" />
    </>
  ),
  "arrow-right": <path d="M4 10h12m0 0-4.5-4.5M16 10l-4.5 4.5" />,
  "arrow-up-right": <path d="M6 14 14 6m0 0H8m6 0v6" />,
  warehouse: (
    <>
      <path d="M2.8 8.4 10 3.2l7.2 5.2v8H2.8z" />
      <path d="M6 16.4v-5h8v5M7.6 8.6h4.8" />
    </>
  ),
  package: (
    <>
      <path d="M4 6.5 10 3l6 3.5v7L10 17l-6-3.5z" />
      <path d="m4 6.5 6 3.5 6-3.5M10 10v7" />
    </>
  ),
  "trend-up": <path d="m4 13 4-4 3 3 5-5m0 0h-4m4 0v4" />,
  "trend-down": <path d="m4 7 4 4 3-3 5 5m0 0h-4m4 0v-4" />,
  sparkles: (
    <>
      <path d="M9.5 3.2 11 7l3.8 1.5L11 10 9.5 13.8 8 10 4.2 8.5 8 7z" />
      <path d="m15.4 12.2.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z" />
    </>
  ),
  send: (
    <>
      <path d="M3.5 10 16.5 4l-3 12-4-4.5z" />
      <path d="m9.5 11.5 7-7.5" />
    </>
  ),
};

export function Icon({
  name,
  className,
  ...props
}: { name: IconName; className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
