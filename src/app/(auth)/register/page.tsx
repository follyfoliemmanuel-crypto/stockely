import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/register-form";
import { getAuthContext } from "@/server/auth/context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Créer mon espace",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  const context = await getAuthContext();
  if (context) redirect("/dashboard");

  return <RegisterForm />;
}
