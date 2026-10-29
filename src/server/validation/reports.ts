import { z } from "zod";

import { isValidIsoDate } from "@/lib/date";

const isoDate = z
  .string()
  .refine(isValidIsoDate, "Date invalide (format attendu : AAAA-MM-JJ).");

/**
 * Query string de l'export de rapport. Une valeur invalide est ignorée
 * (repli sur la période par défaut) pour conserver le comportement de
 * l'interface, sans jamais transmettre la valeur brute au service.
 */
export const reportExportQuerySchema = z.object({
  type: z.enum(["sales", "inventory"]).catch("sales"),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
});
