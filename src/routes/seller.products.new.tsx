import { createFileRoute } from "@tanstack/react-router";
import { ProductEditor } from "@/components/seller/ProductEditor";

export const Route = createFileRoute("/seller/products/new")({
  component: () => <ProductEditor />,
});