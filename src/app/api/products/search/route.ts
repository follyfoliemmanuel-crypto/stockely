import { requireAuth, requirePermission } from "@/server/auth/context";
import { resolveRequestWarehouse } from "@/server/auth/warehouse";
import { boundedQuery, jsonOk, readQuery, route } from "@/server/http";
import {
  findProductByBarcode,
  searchProducts,
} from "@/server/services/products";
import { productSearchQuerySchema } from "@/server/validation/catalog";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const context = await requireAuth();
  requirePermission(context, "products.read");

  const query = readQuery(request, productSearchQuerySchema);
  const barcode = boundedQuery(query.barcode, 64);
  const warehouse = await resolveRequestWarehouse(context);

  if (barcode) {
    const product = await findProductByBarcode(
      context.shop.id,
      barcode,
      warehouse.id,
    );
    return jsonOk({ items: product ? [product] : [] });
  }

  const q = boundedQuery(query.q);
  const items = await searchProducts(context.shop.id, q, 20, warehouse.id);
  return jsonOk({ items });
});
