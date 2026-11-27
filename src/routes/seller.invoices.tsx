import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout for the invoices section. The list lives in the index route so
// this parent never conditionally skips hooks (which caused React error #300
// when navigating between the list and the builder).
export const Route = createFileRoute("/seller/invoices")({ component: () => <Outlet /> });
