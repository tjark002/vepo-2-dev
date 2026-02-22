import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { topic, shop, session, admin } = await authenticate.webhook(request);

  if (!admin && topic !== "SHOP_REDACT") {
    throw new Response();
  }

  switch (topic) {
    case "APP_UNINSTALLED":
      console.log("[Vepo] App uninstalled for shop:", shop);
      if (session) {
        try {
          // Delete in correct order respecting foreign keys
          await db.condition.deleteMany({ where: { shop } });
          await db.optionRule.deleteMany({ where: { shop } });
          await db.virtualProductVariant.deleteMany({ where: { shop } });
          await db.configurableProduct.deleteMany({ where: { shop } });
          await db.option.deleteMany({ where: { shop } });
          await db.productConfigurationOptions.deleteMany({ where: { shop } });
          await db.appSettings.deleteMany({ where: { shop } });
          await db.session.deleteMany({ where: { shop } });
          console.log("[Vepo] All data deleted for shop:", shop);
        } catch (error) {
          console.error("[Vepo] Error deleting data for shop:", shop, error);
        }
      }
      throw new Response("App uninstall handled", { status: 200 });

    case "CUSTOMERS_DATA_REQUEST":
      // No customer data stored by this app
      throw new Response("No stored customer data", { status: 200 });

    case "CUSTOMERS_REDACT":
      // No customer data stored by this app
      throw new Response("No customer data to delete", { status: 200 });

    case "SHOP_REDACT":
      console.log("[Vepo] Shop redact for:", shop);
      try {
        await db.condition.deleteMany({ where: { shop } });
        await db.optionRule.deleteMany({ where: { shop } });
        await db.virtualProductVariant.deleteMany({ where: { shop } });
        await db.configurableProduct.deleteMany({ where: { shop } });
        await db.option.deleteMany({ where: { shop } });
        await db.productConfigurationOptions.deleteMany({ where: { shop } });
        await db.appSettings.deleteMany({ where: { shop } });
        await db.session.deleteMany({ where: { shop } });
      } catch (error) {
        console.error("[Vepo] Error in shop redact:", shop, error);
      }
      throw new Response("Shop data deleted", { status: 200 });

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }
};
