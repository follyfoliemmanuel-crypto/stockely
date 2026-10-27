import { z } from "zod";

import { optionalText } from "./catalog";

const email = z
  .union([z.string().trim().email("Adresse e-mail invalide."), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value && value.length > 0 ? value.toLowerCase() : null));

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(160),
  phone: optionalText(40),
  email,
  address: optionalText(500),
  notes: optionalText(1_000),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(160),
  phone: optionalText(40),
  email,
  address: optionalText(500),
  notes: optionalText(1_000),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
