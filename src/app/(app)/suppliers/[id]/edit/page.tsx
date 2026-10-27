import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page";
import { ContactForm } from "@/components/contacts/contact-form";
import { buttonClasses } from "@/components/ui/button";
import { requirePage } from "@/server/auth/page";
import { getSupplier } from "@/server/services/suppliers";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modifier un fournisseur" };

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePage("suppliers.write");
  const { id } = await params;
  const supplier = await getSupplier(context.shop.id, id);
  if (!supplier) notFound();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Contacts"
        title={`Modifier ${supplier.name}`}
        description="Mettez à jour les coordonnées et les conditions du fournisseur."
        actions={
          <Link href="/suppliers" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Retour aux fournisseurs
          </Link>
        }
      />
      <ContactForm
        kind="supplier"
        mode="edit"
        contact={{
          id: supplier.id,
          name: supplier.name,
          phone: supplier.phone,
          email: supplier.email,
          address: supplier.address,
          notes: supplier.notes,
        }}
      />
    </div>
  );
}
