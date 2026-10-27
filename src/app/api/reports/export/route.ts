import { requireAuth, requirePermission } from "@/server/auth/context";
import { writeAudit } from "@/server/audit";
import { getDb } from "@/server/db";
import { route } from "@/server/http";
import { resolveReportRange } from "@/lib/report-range";
import {
  buildInventoryCsv,
  buildSalesCsv,
} from "@/server/services/reports";

export const dynamic = "force-dynamic";

/**
 * Export CSV des ventes ou du stock. Route GET authentifiée : le cookie de
 * session SameSite protège l'accès, et la permission reports.export est
 * contrôlée côté serveur. Chaque export est journalisé.
 */
export const GET = route(async (request: Request) => {
  const context = await requireAuth();
  requirePermission(context, "reports.export");

  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "inventory" ? "inventory" : "sales";
  const range = resolveReportRange(
    url.searchParams.get("from") ?? undefined,
    url.searchParams.get("to") ?? undefined,
  );

  const result =
    type === "inventory"
      ? await buildInventoryCsv(context.shop.id)
      : await buildSalesCsv(
          context.shop.id,
          context.shop.timezone,
          range.from,
          range.to,
        );

  await writeAudit(getDb(), {
    shopId: context.shop.id,
    userId: context.user.id,
    action: "reports.exported",
    entityType: "report",
    entityId: type,
    metadata: {
      type,
      from: type === "sales" ? range.from : null,
      to: type === "sales" ? range.to : null,
      rows: result.rowCount,
    },
  });

  const filename =
    type === "inventory"
      ? `stockely-stock-${new Date().toISOString().slice(0, 10)}.csv`
      : `stockely-ventes-${range.from}-${range.to}.csv`;

  return new Response(`\uFEFF${result.csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
