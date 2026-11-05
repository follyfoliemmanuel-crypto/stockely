"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Logo } from "@/components/brand/logo";
import { LogoutButton } from "@/components/app/logout-button";
import { Avatar } from "@/components/ui/metrics";
import { ShopSwitcher, type SwitchableShop } from "./shop-switcher";
import {
  WarehouseSwitcher,
  type SwitchableWarehouse,
} from "./warehouse-switcher";
import { NavLinks } from "./nav-links";
import type { NavGroup } from "./nav";

export function MobileMenu({
  groups,
  shops,
  activeShopId,
  warehouses,
  activeWarehouseId,
  userName,
  roleLabel,
}: {
  groups: NavGroup[];
  shops: SwitchableShop[];
  activeShopId: string;
  warehouses: SwitchableWarehouse[];
  activeWarehouseId: string | null;
  userName: string;
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        aria-haspopup="dialog"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-ink shadow-soft transition-colors hover:bg-surface lg:hidden"
      >
        <span className="sr-only">Ouvrir le menu</span>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
          <path
            d="M3 5.5h14M3 10h14M3 14.5h14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Le tiroir est monté dans <body> : l'en-tête utilise backdrop-blur,
          qui ferait de `position: fixed` un positionnement relatif à la barre. */}
      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[60] lg:hidden">
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 h-full w-full bg-ink/30"
            />
            <div
              id="mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navigation"
              className="absolute inset-y-2 left-2 flex w-[min(19rem,88vw)] flex-col overflow-hidden rounded-[1.5rem] border border-line/80 bg-white shadow-float"
            >
              <div className="flex h-16 items-center justify-between border-b border-line/70 px-4">
                <Logo />
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-ink"
                >
                  <span className="sr-only">Fermer le menu</span>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                    <path
                      d="m5 5 10 10M15 5 5 15"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <div className="mx-3 mt-3 space-y-3 rounded-2xl border border-line/60 bg-surface/80 p-3">
                <ShopSwitcher shops={shops} activeShopId={activeShopId} />
                {activeWarehouseId && (
                  <WarehouseSwitcher
                    warehouses={warehouses}
                    activeWarehouseId={activeWarehouseId}
                  />
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-5">
                <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
              </div>

              <div className="p-3">
                <div className="rounded-2xl border border-line/70 bg-surface/70 p-2.5">
                  <div className="flex items-center gap-2.5 px-1 py-1">
                    <Avatar name={userName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8125rem] font-semibold">{userName}</p>
                      <p className="truncate text-[0.6875rem] text-muted">{roleLabel}</p>
                    </div>
                  </div>
                  <LogoutButton />
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
