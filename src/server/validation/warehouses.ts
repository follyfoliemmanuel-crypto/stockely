import { z } from "zod";

import { optionalText } from "@/server/validation/catalog";

const warehouseCode = z
  .string()
  .trim()
  .min(2, "Le code doit contenir au moins 2 caractères.")
  .max(32, "Le code ne peut pas dépasser 32 caractères.")
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(value), {
    message: "Le code accepte uniquement lettres, chiffres, tirets et underscores.",
  });

const warehouseName = z.string().trim().min(1, "Le nom est requis.").max(120);

export const warehouseCreateSchema = z.object({
  name: warehouseName,
  code: warehouseCode,
  address: optionalText(500),
  isDefault: z.boolean().default(false),
});

export const warehouseUpdateSchema = z.object({
  name: warehouseName,
  code: warehouseCode,
  address: optionalText(500),
  isDefault: z.boolean().optional(),
});

export const warehouseArchiveSchema = z.object({
  archived: z.boolean(),
});

export const warehouseAccessSchema = z.object({
  membershipIds: z.array(z.string().uuid()).max(500),
});

export type WarehouseCreateInput = z.infer<typeof warehouseCreateSchema>;
export type WarehouseUpdateInput = z.infer<typeof warehouseUpdateSchema>;
export type WarehouseAccessInput = z.infer<typeof warehouseAccessSchema>;
