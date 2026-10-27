import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getAuthContext } from "@/server/auth/context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  google_not_configured:
    "La connexion Google n'est pas configurée sur cette installation. Utilisez votre adresse e-mail.",
  google_cancelled: "La connexion Google a été annulée.",
  google_failed: "La connexion Google a échoué. Réessayez ou utilisez votre mot de passe.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; reset?: string | string[] }>;
}) {
  const context = await getAuthContext();
  if (context) redirect("/dashboard");

  const params = await searchParams;
  const errorParam = Array.isArray(params.error) ? params.error[0] : params.error;
  const resetParam = Array.isArray(params.reset) ? params.reset[0] : params.reset;
  const initialError = errorParam ? (ERRORS[errorParam] ?? null) : null;
  const notice =
    resetParam === "1"
      ? "Votre mot de passe a été modifié. Vous pouvez vous connecter."
      : null;

  return <LoginForm initialError={initialError} notice={notice} />;
}
