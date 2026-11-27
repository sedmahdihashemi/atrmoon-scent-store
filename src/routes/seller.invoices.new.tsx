import { createFileRoute } from "@tanstack/react-router";
import { InvoiceBuilder } from "@/components/seller/InvoiceBuilder";

export const Route = createFileRoute("/seller/invoices/new")({ component: () => <InvoiceBuilder /> });
