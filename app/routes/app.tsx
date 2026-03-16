import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  console.log("[AppLoader] Request URL:", url.pathname + url.search.slice(0, 100));
  console.log("[AppLoader] SHOPIFY_API_KEY set:", !!process.env.SHOPIFY_API_KEY, "length:", process.env.SHOPIFY_API_KEY?.length);
  console.log("[AppLoader] SHOPIFY_API_SECRET set:", !!process.env.SHOPIFY_API_SECRET, "length:", process.env.SHOPIFY_API_SECRET?.length);
  console.log("[AppLoader] SHOPIFY_APP_URL:", process.env.SHOPIFY_APP_URL);
  try {
    await authenticate.admin(request);
  } catch (err) {
    if (err instanceof Response) {
      console.log("[AppLoader] Auth threw Response:", err.status, err.headers.get("location") || "");
    } else {
      console.error("[AppLoader] Auth error:", err);
    }
    throw err;
  }
  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">Theme Builder</Link>
        <Link to="/app/generate">Generate Theme</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
