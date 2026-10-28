import { z } from "zod";

/**
 * Validation centralisée des variables d'environnement.
 * L'évaluation est paresseuse : le build ne casse pas si une variable
 * n'est utile qu'à l'exécution, mais toute utilisation réelle échoue
 * clairement si la configuration est incomplète.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL est requis")
    .refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
      message: "DATABASE_URL doit être une URL PostgreSQL",
    }),
  APP_SECRET: z
    .string()
    .min(32, "APP_SECRET doit contenir au moins 32 caractères"),
  APP_URL: z
    .string()
    .url("APP_URL doit être une URL valide")
    .transform((value) => value.replace(/\/+$/, "")),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  TEST_DATABASE_URL: z.string().optional(),
  DEFAULT_CURRENCY: z.string().length(3).default("XOF"),
  DEFAULT_TIMEZONE: z.string().min(1).default("Africa/Lome"),

  /* Connexion Google — facultative tant que non configurée. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  /* Envoi d'e-mails — facultatif tant que non configuré. */
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
})
  .superRefine((value, ctx) => {
    // En production, l'application doit être servie en HTTPS : sans cela les
    // cookies `Secure` ne seraient pas envoyés et HSTS n'aurait aucun effet.
    // Les adresses de boucle locale restent tolérées pour les essais locaux.
    const isLocal =
      /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(value.APP_URL);
    if (
      value.NODE_ENV === "production" &&
      !value.APP_URL.startsWith("https://") &&
      !isLocal
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "APP_URL doit utiliser HTTPS en production.",
      });
    }
  })
  .readonly();

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    APP_SECRET: process.env.APP_SECRET,
    APP_URL: process.env.APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || undefined,
    DEFAULT_CURRENCY: process.env.DEFAULT_CURRENCY,
    DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || undefined,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || undefined,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    EMAIL_FROM: process.env.EMAIL_FROM || undefined,
  });

  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(" | ");
    throw new Error(`Configuration invalide — ${messages}`);
  }

  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}
