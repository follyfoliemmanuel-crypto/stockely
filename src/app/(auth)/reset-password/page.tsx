import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getAuthContext } from "@/server/auth/context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  const context = await getAuthContext();
  if (context) redirect("/dashboard");

  // Le jeton est transmis dans le fragment d'URL (#token=…), jamais dans la
  // query string : le serveur ne le voit donc pas. Le composant client le
  // lit au montage puis nettoie immédiatement la barre d'adresse.
  return <ResetPasswordForm />;
}
