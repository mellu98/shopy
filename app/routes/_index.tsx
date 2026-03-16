import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  console.log("[RootRedirect] Full URL:", request.url);
  console.log("[RootRedirect] Search params:", url.search);
  console.log("[RootRedirect] Redirecting to:", `/app${url.search}`);
  throw redirect(`/app${url.search}`);
};
