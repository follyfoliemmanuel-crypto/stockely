import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email("Adresse e-mail invalide.")
  .transform((value) => value.toLowerCase());

const password = z
  .string()
  .min(10, "Le mot de passe doit contenir au moins 10 caractères.")
  .max(200, "Le mot de passe est trop long.");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Le nom est trop court.").max(120),
  email,
  password,
  shopName: z.string().trim().min(2, "Le nom de la boutique est trop court.").max(120),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Devise invalide (code ISO à 3 lettres).")
    .optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Mot de passe requis.").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const switchShopSchema = z.object({
  shopId: z.string().uuid("Identifiant de boutique invalide."),
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, "Jeton invalide.").max(512, "Jeton invalide."),
  password,
});

/**
 * Paramètres du callback Google. Les valeurs sont bornées avant tout usage :
 * un `state` est un jeton base64url généré par l'application, un `code`
 * d'autorisation reste court et imprimable.
 */
const oauthState = z
  .string()
  .min(32, "État OAuth invalide.")
  .max(256, "État OAuth invalide.")
  .regex(/^[A-Za-z0-9_-]+$/, "État OAuth invalide.");

const oauthCode = z
  .string()
  .min(8, "Code OAuth invalide.")
  .max(2_048, "Code OAuth invalide.")
  .regex(/^[\x21-\x7E]+$/, "Code OAuth invalide.");

export const googleCallbackSchema = z.object({
  state: oauthState,
  code: oauthCode,
});

/**
 * Query string du callback Google : Google peut renvoyer `error` à la place
 * de `code`/`state` (consentement refusé, configuration invalide…).
 */
export const googleCallbackQuerySchema = z.object({
  error: z.string().max(100, "Erreur OAuth invalide.").optional(),
  state: oauthState.optional(),
  code: oauthCode.optional(),
});
