import { json } from "@remix-run/node";
import { vepoGetConfigurations } from "../models/VepoConfigurator.server";
import { vepoGetAppSettings } from "../models/VepoSettings.server";
import shopify from "../shopify.server";

export async function loader({ request }) {
  try {
    const { session, admin } = await shopify.authenticate.public.appProxy(request);

    if (!session) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const productConfig = await vepoGetConfigurations(session.shop, admin.graphql, true);
    const appSettings = await vepoGetAppSettings(session.shop);

    return json({
      productConfig,
      appSettings,
    });
  } catch (error) {
    console.error("[Vepo] Error in app proxy loader:", error?.message || error);
    // Return valid JSON even on error so storefront JS can parse it
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error?.message || error) }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
