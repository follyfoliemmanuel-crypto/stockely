/**
 * Identité publique du site.
 *
 * `APP_URL` (définie sur Vercel) fait foi. En son absence, on retombe sur
 * l'URL du déploiement de production : les URL canoniques, le sitemap, le
 * fichier robots et la redirection Google ne doivent jamais pointer vers
 * `localhost`.
 */
export const SITE_URL = (
  process.env.APP_URL ?? "https://stockely.vercel.app"
).replace(/\/+$/, "");

export const SITE_NAME = "Stockely";

export const SITE_TITLE =
  "Stockely — Votre stock, votre commerce, sous contrôle.";

export const SITE_DESCRIPTION =
  "Stockely réunit inventaire, caisse, clients, fournisseurs et rapports dans un espace unique. Chaque mouvement est tracé, chaque vente vérifiée côté serveur.";

export const SITE_LOCALE = "fr_FR";
