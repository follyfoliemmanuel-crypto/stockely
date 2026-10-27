import { z } from "zod";

export const transferItemCreateSchema = z.object({
  productId: z.string().uuid("Identifiant de produit invalide."),
  quantity: z
    .number()
    .int("La quantité doit être un entier.")
    .positive("La quantité doit être supérieure à zéro.")
    .max(1_000_000, "Quantité excessive."),
});

export const transferCreateSchema = z
  .object({
    fromWarehouseId: z.string().uuid("Entrepôt d'origine invalide."),
    toWarehouseId: z.string().uuid("Entrepôt de destination invalide."),
    note: z
      .union([z.string().trim().max(500), z.literal(""), z.null()])
      .optional()
      .transform((val) => (val && val.length > 0 ? val : null)),
    items: z
      .array(transferItemCreateSchema)
      .min(1, "Au moins un produit doit être transféré.")
      .max(100, "Maximum 100 produits par transfert.")
      .refine(
        (items) => new Set(items.map((i) => i.productId)).size === items.length,
        "Un produit ne peut pas apparaître deux fois dans le même transfert.",
      ),
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(120)
      .nullish(),
  })
  .refine(
    (data) => data.fromWarehouseId !== data.toWarehouseId,
    {
      message: "L'entrepôt d'origine et l'entrepôt de destination doivent être différents.",
      path: ["toWarehouseId"],
    },
  );

export const transferShipSchema = z.object({
  note: z
    .union([z.string().trim().max(500), z.literal(""), z.null()])
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export const transferReceiveItemSchema = z.object({
  productId: z.string().uuid("Identifiant de produit invalide."),
  quantityReceived: z
    .number()
    .int("La quantité reçue doit être un entier.")
    .nonnegative("La quantité reçue ne peut pas être négative.")
    .max(1_000_000, "Quantité excessive."),
  discrepancyReason: z
    .union([z.string().trim().max(500), z.literal(""), z.null()])
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export const transferReceiveSchema = z.object({
  items: z
    .array(transferReceiveItemSchema)
    .min(1, "Au moins une ligne de réception requise.")
    .refine(
      (items) => new Set(items.map((i) => i.productId)).size === items.length,
      "Chaque produit ne peut avoir qu'une ligne de réception.",
    ),
  note: z
    .union([z.string().trim().max(500), z.literal(""), z.null()])
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export const transferCancelSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Le motif d'annulation doit comporter au moins 3 caractères.")
    .max(500, "Le motif ne doit pas dépasser 500 caractères."),
});

export type TransferCreateInput = z.infer<typeof transferCreateSchema>;
export type TransferShipInput = z.infer<typeof transferShipSchema>;
export type TransferReceiveInput = z.infer<typeof transferReceiveSchema>;
export type TransferCancelInput = z.infer<typeof transferCancelSchema>;
