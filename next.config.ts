import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Fabrique une entrée d'en-tête Next.js.
 * Les valeurs ci-dessous sont des noms d'en-têtes HTTP publics et des
 * directives normalisées : aucun secret ne doit être ajouté dans ce fichier
 * (voir `src/lib/env.ts` pour la configuration serveur).
 */
function header(key: string, value: string): { key: string; value: string } {
  return { key, value };
}

/**
 * En-têtes de sécurité appliqués à toutes les réponses.
 * La CSP reste compatible avec Next.js : les scripts inline sont nécessaires
 * au bootstrap, mais `unsafe-eval` est réservé au serveur de développement.
 */
const securityHeaders = [
  header("X-Content-Type-Options", "nosniff"),
  header("X-Frame-Options", "DENY"),
  header("X-DNS-Prefetch-Control", "off"),
  header("X-Permitted-Cross-Domain-Policies", "none"),
  header("Referrer-Policy", "strict-origin-when-cross-origin"),
  header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  ),
  header("Cross-Origin-Opener-Policy", "same-origin"),
  header("Cross-Origin-Resource-Policy", "same-origin"),
  header(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      ...(isProduction ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  ),
  ...(isProduction
    ? [
        header(
          "Strict-Transport-Security",
          "max-age=63072000; includeSubDomains; preload",
        ),
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "pg"],
  images: {
    // Next 16 sert par défaut les images optimisées en pièce jointe
    // (`Content-Disposition: attachment`), ce qui empêche le navigateur
    // de les afficher dans une balise <img>. On rétablit le rendu inline.
    contentDispositionType: "inline",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
