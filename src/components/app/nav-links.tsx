"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import type { NavGroup, NavIcon } from "./nav";

function NavIconGlyph({ icon }: { icon: NavIcon }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (icon) {
    case "dashboard":
      return (
        <path
          d="M3.5 3.5h5v5h-5zM11.5 3.5h5v3h-5zM11.5 9.5h5v7h-5zM3.5 11.5h5v5h-5z"
          {...common}
        />
      );
    case "products":
      return (
        <path
          d="m10 2.8 6 3.2v7.8l-6 3.4-6-3.4V6zM4 6l6 3.2L16 6M10 9.2v8"
          {...common}
        />
      );
    case "categories":
      return (
        <path
          d="M3 5.2A1.2 1.2 0 0 1 4.2 4h4.1l2 2h5.5A1.2 1.2 0 0 1 17 7.2v7.6A1.2 1.2 0 0 1 15.8 16H4.2A1.2 1.2 0 0 1 3 14.8z"
          {...common}
        />
      );
    case "stock":
      return (
        <path
          d="M4 7h9m0 0-2.5-2.5M13 7l-2.5 2.5M16 13H7m0 0 2.5-2.5M7 13l2.5 2.5"
          {...common}
        />
      );
    case "warehouses":
      return (
        <path
          d="M2.8 8.4 10 3.2l7.2 5.2v8H2.8zM6 16.4v-5h8v5M7.6 8.6h4.8"
          {...common}
        />
      );
    case "transfers":
      return (
        <path
          d="M3 6h11m0 0-3-3m3 3-3 3M17 14H6m0 0 3-3m-3 3 3 3"
          {...common}
        />
      );
    case "pos":
      return (
        <path
          d="M4 3.5h12v13H4zM6.5 6.5h7M6.5 10h2M11.5 10h2M6.5 13h2M11.5 13h2"
          {...common}
        />
      );
    case "sales":
      return (
        <path
          d="M5 2.8h10v14.4l-2.5-1.6-2.5 1.6-2.5-1.6L5 17.2zM7.5 6.5h5M7.5 9.5h5M7.5 12.5h3"
          {...common}
        />
      );
    case "customers":
      return (
        <path
          d="M7.2 9.2a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 17a4.7 4.7 0 0 1 9.4 0M13 6.5a2.5 2.5 0 0 1 0 5M14.2 12.6a4.3 4.3 0 0 1 3.3 4.4"
          {...common}
        />
      );
    case "suppliers":
      return (
        <path
          d="M2.8 5h9v9h-9zM11.8 8h2.8l2.6 2.6V14h-5.4M5.5 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM14.5 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
          {...common}
        />
      );
    case "reports":
      return (
        <path
          d="M3.5 16.5V11m4.3 5.5V6.5m4.4 10v-7m4.3 7v-12"
          {...common}
        />
      );
    case "audit":
      return (
        <path
          d="M5 2.8h10v14.4H5zM7.5 6.5h5M7.5 9.5h5M7.5 12.5h3"
          {...common}
        />
      );
  }
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/sales") {
    return pathname === "/sales" || (pathname.startsWith("/sales/") && pathname !== "/sales/new");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({
  groups,
  onNavigate,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation de l'application" className="space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-[0.625rem] font-bold uppercase tracking-[0.18em] text-muted/70">
            {group.label}
          </p>
          <ul className="mt-2 space-y-1">
            {group.items.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-[2.35rem] items-center gap-2.5 rounded-xl px-3 text-[0.8125rem] font-semibold transition-colors",
                      active
                        ? "bg-accent-soft text-ink shadow-[inset_0_0_0_1px_rgb(233_214_107/0.35)]"
                        : "text-muted hover:bg-surface hover:text-ink",
                    )}
                  >
                    <svg
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-accent-ink" : "text-muted/80",
                      )}
                    >
                      <NavIconGlyph icon={item.icon} />
                    </svg>
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
