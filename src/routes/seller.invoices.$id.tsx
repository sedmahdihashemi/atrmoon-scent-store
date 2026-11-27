import { createFileRoute } from "@tanstack/react-router";
import { InvoiceBuilder } from "@/components/seller/InvoiceBuilder";

export const Route = createFileRoute("/seller/invoices/$id")({
  component: InvoiceEditRoute,
});

function InvoiceEditRoute() {
  const { id } = Route.useParams();
  return <InvoiceBuilder invoiceId={id} />;
}
