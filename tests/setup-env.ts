import "dotenv/config";

/**
 * Les tests unitaires n'ont pas besoin de base.
 * Les tests d'intégration basculent sur TEST_DATABASE_URL, jamais sur la base
 * de développement. Sans TEST_DATABASE_URL, ils sont ignorés.
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
