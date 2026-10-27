import { requireAuth, requirePermission } from "@/server/auth/context";
import { resolveRequestWarehouse } from "@/server/auth/warehouse";
import { boundedQuery, jsonOk, route } from "@/server/http";
import {
  findProductByBarcode,
  searchProducts,
} from "@/server/services/products";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const context = await requireAuth();
  requirePermission(context, "products.read");

  const url = new URL(request.url);
  const barcode = boundedQuery(url.searchParams.get("barcode"), 64);
  const warehouse = await resolveRequestWarehouse(context);

  if (barcode) {
    const product = await findProductByBarcode(
      context.shop.id,
      barcode,
      warehouse.id,
    );
    return jsonOk({ items: product ? [product] : [] });
  }

  const q = boundedQuery(url.searchParams.get("q"));
  const items = await searchProducts(context.shop.id, q, 20, warehouse.id);
  return jsonOk({ items });
});
