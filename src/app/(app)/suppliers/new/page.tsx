import Link from "next/link";

import { PageHeader } from "@/components/ui/page";
import { ContactForm } from "@/components/contacts/contact-form";
import { buttonClasses } from "@/components/ui/button";
import { requirePage } from "@/server/auth/page";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nouveau fournisseur" };

export default async function NewSupplierPage() {
  await requirePage("suppliers.write");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Contacts"
        title="Nouveau fournisseur"
        description="Ajoutez un fournisseur pour le rattacher aux produits et conserver ses coordonnées."
        actions={
          <Link href="/suppliers" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Retour aux fournisseurs
          </Link>
        }
      />
      <ContactForm kind="supplier" mode="create" />
    </div>
  );
}
