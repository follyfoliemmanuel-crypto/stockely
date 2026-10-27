import { redirect } from "next/navigation";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getAuthContext } from "@/server/auth/context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mot de passe oublié",
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage() {
  const context = await getAuthContext();
  if (context) redirect("/dashboard");

  return <ForgotPasswordForm />;
}
