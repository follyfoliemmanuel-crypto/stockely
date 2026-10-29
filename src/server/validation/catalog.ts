import { z } from "zod";

export const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

export const optionalUuid = z
  .union([z.string().uuid(), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const moneyCents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const quantity = z.number().int().nonnegative().max(1_000_000);

const productBaseSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(160),
  sku: z.string().trim().min(1, "Le SKU est requis.").max(64),
  barcode: optionalText(64),
  description: optionalText(2_000),
  categoryId: optionalUuid,
  supplierId: optionalUuid,
  costCents: moneyCents.nullable().default(null),
  priceCents: moneyCents,
  minStock: quantity.default(0),
});

export const productCreateSchema = productBaseSchema.extend({
  initialQuantity: quantity.default(0),
});

export const productUpdateSchema = productBaseSchema;

export const productArchiveSchema = z.object({
  archived: z.boolean(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(80),
  description: optionalText(500),
});

/** Recherche produit par code-barres ou par texte libre. */
export const productSearchQuerySchema = z.object({
  barcode: z.string().max(64).optional().catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
