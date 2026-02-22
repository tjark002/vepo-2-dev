import db from "../db.server";

export async function vepoGetAppSettings(shopDomain) {
  const appSettings = await db.appSettings.findUnique({
    where: { shop: shopDomain },
  });

  return {
    id: appSettings?.id || 0,
    shop: appSettings?.shop || shopDomain,
    inputBackgroundColor: appSettings?.inputBackgroundColor || "#ffffff",
    inputTextColor: appSettings?.inputTextColor || "#000000",
    headlineTextColor: appSettings?.headlineTextColor || "#000000",
    inputBorderRadius: appSettings?.inputBorderRadius || "5px",
    buttonColor: appSettings?.buttonColor || "#000000",
    buttonTextColor: appSettings?.buttonTextColor || "#ffffff",
    buttonBorderRadius: appSettings?.buttonBorderRadius || "5px",
    buttonPadding: appSettings?.buttonPadding || "10px",
    isButtonFullWidth: appSettings?.isButtonFullWidth || false,
  };
}

export async function vepoSaveAppSettings(shopDomain, data) {
  try {
    const existing = await db.appSettings.findUnique({
      where: { shop: shopDomain },
    });

    if (existing) {
      return await db.appSettings.update({
        where: { shop: shopDomain },
        data: {
          inputBackgroundColor: data.inputBackgroundColor,
          inputTextColor: data.inputTextColor,
          headlineTextColor: data.headlineTextColor,
          inputBorderRadius: data.inputBorderRadius,
          buttonColor: data.buttonColor,
          buttonTextColor: data.buttonTextColor,
          buttonBorderRadius: data.buttonBorderRadius,
          buttonPadding: data.buttonPadding,
          isButtonFullWidth: data.isButtonFullWidth === "true" || data.isButtonFullWidth === true,
        },
      });
    }

    return await db.appSettings.create({
      data: {
        shop: shopDomain,
        inputBackgroundColor: data.inputBackgroundColor || "#ffffff",
        inputTextColor: data.inputTextColor || "#000000",
        headlineTextColor: data.headlineTextColor || "#000000",
        inputBorderRadius: data.inputBorderRadius || "5px",
        buttonColor: data.buttonColor || "#000000",
        buttonTextColor: data.buttonTextColor || "#ffffff",
        buttonBorderRadius: data.buttonBorderRadius || "5px",
        buttonPadding: data.buttonPadding || "10px",
        isButtonFullWidth: data.isButtonFullWidth === "true" || data.isButtonFullWidth === true,
      },
    });
  } catch (error) {
    console.error("[Vepo] Error saving app settings:", error);
    throw error;
  }
}
