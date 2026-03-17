import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "~/db.server";

/**
 * GET /app/api/reset-sessions
 * Deletes all sessions to force re-authentication with updated scopes.
 * This is a utility route — remove in production.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // First, show current sessions
  const sessions = await db.session.findMany({
    select: { id: true, shop: true, scope: true, isOnline: true },
  });

  console.log("[ResetSessions] Current sessions:", JSON.stringify(sessions, null, 2));

  // Delete all sessions
  const deleted = await db.session.deleteMany({});

  console.log(`[ResetSessions] Deleted ${deleted.count} sessions`);

  return json({
    message: `Deleted ${deleted.count} sessions. Please reload the app to re-authenticate.`,
    deletedSessions: sessions,
  });
};
