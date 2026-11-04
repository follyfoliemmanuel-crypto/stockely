import { VerifyEmailStatus } from "@/components/auth/verify-email-status";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vérification de l'e-mail",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  // Le jeton est lu côté client dans le fragment d'URL, jamais côté serveur.
  return <VerifyEmailStatus />;
}
