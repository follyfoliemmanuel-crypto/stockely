import { sql } from "drizzle-orm";

import { getEnv } from "@/lib/env";
import { getDb } from "@/server/db";
import { route } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * Contrôle de santé : vérifie la configuration et la connexion PostgreSQL.
 * Ne divulgue aucun secret ni détail interne.
 */
export const GET = route(async () => {
  let config: "ok" | "incomplete" = "ok";
  let features = { google: false, email: false };

  try {
    const env = getEnv();
    features = {
      google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
    };
  } catch {
    config = "incomplete";
  }

  let db: "ok" | "unavailable" = "ok";
  try {
    await getDb().execute(sql`select 1`);
  } catch {
    db = "unavailable";
  }

  const healthy = config === "ok" && db === "ok";
  const body = {
    status: healthy ? "ok" : "degraded",
    db,
    config,
    features,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status: healthy ? 200 : 503,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
