import { z } from "zod";

export const saleItemInputSchema = z.object({
  productId: z.string().uuid("Produit invalide."),
  quantity: z.number().int().positive().max(100_000),
});

export const saleCreateSchema = z.object({
  items: z.array(saleItemInputSchema).min(1, "Le panier est vide.").max(100),
  customerId: z
    .union([z.string().uuid(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  discountCents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
  paymentMethod: z.enum(["cash", "mobile_money", "card", "other"]),
  reference: z
    .union([z.string().trim().max(120), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  note: z
    .union([z.string().trim().max(500), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const saleCancelSchema = z.object({
  reason: z.string().trim().min(3, "Indiquez un motif.").max(500),
});

export type SaleCreateInput = z.infer<typeof saleCreateSchema>;
export type SaleCancelInput = z.infer<typeof saleCancelSchema>;
