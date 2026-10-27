import Link from "next/link";

import { PageHeader } from "@/components/ui/page";
import { ContactForm } from "@/components/contacts/contact-form";
import { buttonClasses } from "@/components/ui/button";
import { requirePage } from "@/server/auth/page";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nouveau client" };

export default async function NewCustomerPage() {
  await requirePage("customers.write");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Contacts"
        title="Nouveau client"
        description="Créez une fiche pour rattacher les prochaines ventes et retrouver l'historique d'achats."
        actions={
          <Link href="/customers" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Retour aux clients
          </Link>
        }
      />
      <ContactForm kind="customer" mode="create" />
    </div>
  );
}
