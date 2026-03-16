import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Badge,
  DataTable,
  Link,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const themes = await db.generatedTheme.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return json({
    themes: themes.map((t) => ({
      id: t.id,
      themeName: t.themeName,
      status: t.status,
      shopifyThemeId: t.shopifyThemeId ? Number(t.shopifyThemeId) : null,
      error: t.error,
      createdAt: t.createdAt.toISOString(),
    })),
  });
};

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge tone="success">Completed</Badge>;
    case "generating":
    case "uploading":
      return <Badge tone="attention">In Progress</Badge>;
    case "failed":
      return <Badge tone="critical">Failed</Badge>;
    default:
      return <Badge>Pending</Badge>;
  }
}

export default function GeneratePage() {
  const { themes } = useLoaderData<typeof loader>();

  const rows = themes.map((t) => [
    t.themeName,
    statusBadge(t.status),
    t.shopifyThemeId ? String(t.shopifyThemeId) : "-",
    t.error || "-",
    new Date(t.createdAt).toLocaleDateString(),
  ]);

  return (
    <Page title="Generated Themes" subtitle="History of theme generation jobs">
      <Layout>
        <Layout.Section>
          {themes.length === 0 ? (
            <Card>
              <BlockStack gap="200">
                <Text as="p">
                  No themes generated yet. Go to the{" "}
                  <Link url="/app">Theme Builder</Link> to create your first
                  theme.
                </Text>
              </BlockStack>
            </Card>
          ) : (
            <Card>
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text"]}
                headings={[
                  "Theme Name",
                  "Status",
                  "Shopify Theme ID",
                  "Error",
                  "Created",
                ]}
                rows={rows}
              />
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
