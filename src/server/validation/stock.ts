import { z } from "zod";

export const stockMovementSchema = z
  .object({
    productId: z.string().uuid("Produit invalide."),
    type: z.enum(["in", "out", "adjustment"]),
    /** Pour "adjustment", représente la quantité physique constatée. */
    quantity: z.number().int().nonnegative().max(1_000_000),
    unitCostCents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
    reason: z
      .union([z.string().trim().max(500), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
    /** Optionnel : évite de rejouer un mouvement réseau dupliqué. */
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(120)
      .nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.type !== "adjustment" && value.quantity < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "La quantité doit être supérieure à zéro.",
      });
    }
  });

export type StockMovementInput = z.infer<typeof stockMovementSchema>;
