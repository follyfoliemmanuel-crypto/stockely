import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";

import { Logo } from "@/components/brand/logo";
import { LogoutButton } from "@/components/app/logout-button";
import { MobileMenu } from "@/components/app/mobile-menu";
import { NavLinks } from "@/components/app/nav-links";
import { NAV_GROUPS, type NavGroup } from "@/components/app/nav";
import { ShopSwitcher } from "@/components/app/shop-switcher";
import { WarehouseSwitcher } from "@/components/app/warehouse-switcher";
import { buttonClasses } from "@/components/ui/button";
import { Avatar } from "@/components/ui/metrics";
import { getAuthContext } from "@/server/auth/context";
import { getRequestWarehouseId } from "@/server/auth/warehouse";
import { getDb } from "@/server/db";
import { memberships, shops } from "@/server/db/schema";
import { roleLabel, type Permission } from "@/server/permissions";
import { listAccessibleWarehouses } from "@/server/services/warehouses";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getAuthContext();
  if (!context) redirect("/login");

  const [shopRows, warehouseRows, requestedWarehouseId] = await Promise.all([
    getDb()
      .select({
        id: shops.id,
        name: shops.name,
        slug: shops.slug,
        currency: shops.currency,
        timezone: shops.timezone,
      })
      .from(memberships)
      .innerJoin(shops, eq(shops.id, memberships.shopId))
      .where(and(eq(memberships.userId, context.user.id), isNull(shops.archivedAt)))
      .orderBy(memberships.createdAt),
    listAccessibleWarehouses(context),
    getRequestWarehouseId(),
  ]);

  const activeWarehouse =
    warehouseRows.find((warehouse) => warehouse.id === requestedWarehouseId) ??
    warehouseRows.find((warehouse) => warehouse.isDefault) ??
    warehouseRows[0] ??
    null;

  const groups: NavGroup[] = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      context.permissions.has(item.permission as Permission),
    ),
  })).filter((group) => group.items.length > 0);

  const canSell = context.permissions.has("sales.create");

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-3 left-3 z-40 hidden w-[16.5rem] flex-col overflow-hidden rounded-[1.6rem] border border-line/80 bg-white/95 shadow-card backdrop-blur-xl lg:flex print:hidden">
        <div className="flex h-[4.5rem] shrink-0 items-center px-5">
          <Logo />
        </div>

        <div className="mx-3 space-y-3 rounded-2xl border border-line/60 bg-surface/80 p-3.5">
          <ShopSwitcher shops={shopRows} activeShopId={context.shop.id} />
          {activeWarehouse && (
            <WarehouseSwitcher
              warehouses={warehouseRows}
              activeWarehouseId={activeWarehouse.id}
            />
          )}
        </div>

        {canSell && (
          <div className="px-3 pt-3">
            <Link
              href="/sales/new"
              className={buttonClasses({ size: "sm", className: "w-full" })}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                <path
                  d="M10 4v12M4 10h12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              Nouvelle vente
            </Link>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <NavLinks groups={groups} />
        </div>

        <div className="shrink-0 p-3">
          <div className="rounded-2xl border border-line/70 bg-surface/70 p-2.5">
            <div className="flex items-center gap-2.5 px-1 py-1">
              <Avatar name={context.user.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8125rem] font-semibold">{context.user.name}</p>
                <p className="truncate text-[0.6875rem] text-muted">
                  {roleLabel(context.role)}
                </p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="lg:pl-[17.75rem] print:pl-0">
        <header className="sticky top-0 z-30 px-3 pt-3 sm:px-5 lg:px-7 print:hidden">
          <div className="flex h-14 items-center justify-between gap-3 rounded-2xl border border-line/70 bg-white/80 px-3 shadow-soft backdrop-blur-xl sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <MobileMenu
                groups={groups}
                shops={shopRows}
                activeShopId={context.shop.id}
                warehouses={warehouseRows}
                activeWarehouseId={activeWarehouse?.id ?? null}
                userName={context.user.name}
                roleLabel={roleLabel(context.role)}
              />
              <div className="lg:hidden">
                <Logo compact />
              </div>
              <div className="hidden min-w-0 lg:block">
                <p className="truncate text-[0.8125rem] font-semibold">{context.shop.name}</p>
                <p className="tabular font-mono text-[0.625rem] uppercase tracking-[0.08em] text-muted">
                  {context.shop.currency} · {context.shop.timezone}
                </p>
              </div>
              {activeWarehouse && (
                <span className="hidden items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[0.6875rem] font-semibold text-accent-ink md:inline-flex">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-strong" />
                  {activeWarehouse.name}
                  <span className="font-mono text-[0.625rem] font-medium opacity-70">
                    {activeWarehouse.code}
                  </span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {canSell && (
                <Link
                  href="/sales/new"
                  className={buttonClasses({ size: "sm", className: "hidden sm:inline-flex" })}
                >
                  Vendre
                </Link>
              )}
              <span className="hidden rounded-full border border-line/80 bg-surface px-2.5 py-1 text-[0.6875rem] font-semibold text-muted md:inline">
                {roleLabel(context.role)}
              </span>
              <div className="lg:hidden">
                <LogoutButton compact />
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7 print:mx-0 print:max-w-none print:px-0 print:py-0">
          {children}
        </main>
      </div>
    </div>
  );
}
