import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page";
import { ContactForm } from "@/components/contacts/contact-form";
import { buttonClasses } from "@/components/ui/button";
import { requirePage } from "@/server/auth/page";
import { getCustomer } from "@/server/services/customers";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modifier un client" };

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePage("customers.write");
  const { id } = await params;
  const customer = await getCustomer(context.shop.id, id);
  if (!customer) notFound();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Contacts"
        title={`Modifier ${customer.name}`}
        description="Mettez à jour les coordonnées et les notes internes de la fiche client."
        actions={
          <Link
            href={`/customers/${customer.id}`}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Voir la fiche
          </Link>
        }
      />
      <ContactForm
        kind="customer"
        mode="edit"
        contact={{
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          notes: customer.notes,
        }}
      />
    </div>
  );
}
