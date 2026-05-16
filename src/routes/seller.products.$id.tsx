import { createFileRoute } from "@tanstack/react-router";
import { ProductEditor } from "@/components/seller/ProductEditor";

export const Route = createFileRoute("/seller/products/$id")({
  component: ProductEditPage,
});

function ProductEditPage() {
  const { id } = Route.useParams();
  return <ProductEditor productId={id} />;
}