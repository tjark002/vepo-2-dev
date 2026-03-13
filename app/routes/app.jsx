import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { I18nProvider, useTranslation } from "../utils/i18n";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <I18nProvider locale="de">
        <AppContent />
      </I18nProvider>
    </AppProvider>
  );
}

function AppContent() {
  const { t } = useTranslation();
  return (
    <>
      <NavMenu>
        <Link to="/app" rel="home">
          {t("common.configurators")}
        </Link>
        <Link to="/app/themesetup">Theme Setup</Link>
      </NavMenu>
      <div style={{ paddingBottom: "2rem" }}>
        <Outlet />
      </div>
    </>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
