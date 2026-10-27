import Link from "next/link";
import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getAuthContext } from "@/server/auth/context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const context = await getAuthContext();
  if (context) redirect("/dashboard");

  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  if (!token) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">Lien incomplet</h1>
        <p className="mt-3 text-[0.875rem] leading-6 text-muted">
          Ce lien de réinitialisation ne contient pas de jeton valide. Demandez un
          nouveau lien pour continuer.
        </p>
        <Link
          href="/forgot-password"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-primary-dark px-4 text-sm font-medium text-white transition-colors hover:bg-[#166534]"
        >
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
