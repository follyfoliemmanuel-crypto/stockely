import { z } from "zod";

import { isValidIsoDate } from "@/lib/date";

const isoDate = z
  .string()
  .refine(isValidIsoDate, "Date invalide (format attendu : AAAA-MM-JJ).");

const MAX_CONTENT_LENGTH = 2_000;
const MAX_TOTAL_LENGTH = 8_000;

/**
 * Conversation envoyée par le navigateur. Les rôles `system` et `tool` sont
 * interdits : seul le serveur compose les instructions système.
 */
export const aiChatSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(MAX_CONTENT_LENGTH),
        }),
      )
      .min(1)
      .max(12),
  })
  .refine(
    (value) =>
      value.messages.reduce((total, message) => total + message.content.length, 0) <=
      MAX_TOTAL_LENGTH,
    { message: "La conversation est trop longue." },
  );

export const aiSummarySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const aiProductDescriptionSchema = z.object({
  name: z.string().trim().min(2).max(160),
  categoryName: z.string().trim().max(80).nullable().optional(),
  priceCents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
});
