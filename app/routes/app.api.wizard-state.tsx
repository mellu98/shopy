import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * GET: Load saved wizard state for the current shop
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const state = await db.wizardState.findUnique({
    where: { shop: session.shop },
  });

  if (!state) {
    return json({ saved: false });
  }

  return json({
    saved: true,
    step: state.step,
    config: JSON.parse(state.config),
    copyInput: state.copyInput ? JSON.parse(state.copyInput) : null,
    copyGenerated: state.copyGenerated,
  });
};

/**
 * POST: Save wizard state for the current shop
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const step = parseInt(formData.get("step") as string) || 1;
  const config = formData.get("config") as string;
  const copyInput = formData.get("copyInput") as string;
  const copyGenerated = formData.get("copyGenerated") === "true";

  if (!config) {
    return json({ error: "Missing config" }, { status: 400 });
  }

  await db.wizardState.upsert({
    where: { shop: session.shop },
    create: {
      shop: session.shop,
      step,
      config,
      copyInput: copyInput || null,
      copyGenerated,
    },
    update: {
      step,
      config,
      copyInput: copyInput || null,
      copyGenerated,
    },
  });

  return json({ success: true });
};
