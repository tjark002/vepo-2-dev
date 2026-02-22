-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `isOnline` BOOLEAN NOT NULL DEFAULT false,
    `scope` VARCHAR(191) NULL,
    `expires` DATETIME(3) NULL,
    `accessToken` VARCHAR(191) NOT NULL,
    `userId` BIGINT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductConfigurationOptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `shop` VARCHAR(191) NOT NULL,
    `priceFormula` VARCHAR(191) NOT NULL DEFAULT '',
    `priceMode` VARCHAR(191) NOT NULL DEFAULT 'price-formula',
    `activateSurcharges` BOOLEAN NOT NULL DEFAULT false,
    `formulaModeSurcharges` BOOLEAN NOT NULL DEFAULT true,
    `useVariantNameInFormula` BOOLEAN NOT NULL DEFAULT true,
    `useUnifiedSku` BOOLEAN NOT NULL DEFAULT false,
    `unifiedSku` VARCHAR(191) NOT NULL DEFAULT '',
    `minimumPrice` DOUBLE NOT NULL DEFAULT 0.00,
    `useMinimumPrice` BOOLEAN NOT NULL DEFAULT false,
    `basePrice` DOUBLE NOT NULL DEFAULT 0.00,
    `redirectToDifferentPage` BOOLEAN NOT NULL DEFAULT false,
    `redirectLink` VARCHAR(191) NOT NULL DEFAULT '',
    `optionOrder` VARCHAR(191) NOT NULL DEFAULT '[]',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConfigurableProduct` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `productHandle` VARCHAR(191) NOT NULL,
    `productVariantId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `optionsId` INTEGER NOT NULL,

    UNIQUE INDEX `ConfigurableProduct_productId_key`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppSettings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop` VARCHAR(191) NOT NULL,
    `inputBackgroundColor` VARCHAR(191) NOT NULL DEFAULT '#ffffff',
    `inputTextColor` VARCHAR(191) NOT NULL DEFAULT '#000000',
    `headlineTextColor` VARCHAR(191) NOT NULL DEFAULT '#000000',
    `inputBorderRadius` VARCHAR(191) NOT NULL DEFAULT '5px',
    `buttonColor` VARCHAR(191) NOT NULL DEFAULT '#000000',
    `buttonTextColor` VARCHAR(191) NOT NULL DEFAULT '#ffffff',
    `buttonBorderRadius` VARCHAR(191) NOT NULL DEFAULT '5px',
    `buttonPadding` VARCHAR(191) NOT NULL DEFAULT '10px',
    `isButtonFullWidth` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `AppSettings_shop_key`(`shop`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Option` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `description` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isMultiselect` BOOLEAN NOT NULL DEFAULT false,
    `isPreselected` BOOLEAN NOT NULL DEFAULT false,
    `hasAdditionalPrice` BOOLEAN NOT NULL DEFAULT false,
    `additionalPrice` DOUBLE NOT NULL DEFAULT 0,
    `checkBoxLabel` VARCHAR(191) NOT NULL DEFAULT '',
    `maxLength` INTEGER NOT NULL DEFAULT 0,
    `placeholder` VARCHAR(1000) NOT NULL DEFAULT '',
    `min` DOUBLE NOT NULL DEFAULT 0,
    `max` DOUBLE NOT NULL DEFAULT 0,
    `default` DOUBLE NOT NULL DEFAULT 0,
    `unit` VARCHAR(191) NOT NULL DEFAULT '',
    `allowedFileTypes` VARCHAR(191) NOT NULL DEFAULT '',
    `values` TEXT NOT NULL,
    `displayMode` VARCHAR(191) NOT NULL DEFAULT '',
    `allowAllDates` BOOLEAN NOT NULL DEFAULT true,
    `minDate` VARCHAR(191) NOT NULL DEFAULT '',
    `maxDate` VARCHAR(191) NOT NULL DEFAULT '',
    `productBundleVariantId` VARCHAR(191) NOT NULL DEFAULT '',
    `decimalPlaces` INTEGER NOT NULL DEFAULT -1,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VirtualProductVariant` (
    `shop` VARCHAR(191) NOT NULL,
    `variantHandle` VARCHAR(191) NOT NULL,
    `configurationId` INTEGER NOT NULL,
    `variantPrice` DOUBLE NOT NULL DEFAULT 0.00,

    PRIMARY KEY (`shop`, `configurationId`, `variantHandle`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OptionRule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop` VARCHAR(191) NOT NULL,
    `configurationId` INTEGER NOT NULL,
    `show` BOOLEAN NOT NULL,
    `targetOptionId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Condition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop` VARCHAR(191) NOT NULL,
    `ruleId` INTEGER NOT NULL,
    `optionId` INTEGER NOT NULL,
    `operator` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_ProductConfigurationOptions_Option` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_ProductConfigurationOptions_Option_AB_unique`(`A`, `B`),
    INDEX `_ProductConfigurationOptions_Option_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ConfigurableProduct` ADD CONSTRAINT `ConfigurableProduct_optionsId_fkey` FOREIGN KEY (`optionsId`) REFERENCES `ProductConfigurationOptions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VirtualProductVariant` ADD CONSTRAINT `VirtualProductVariant_configurationId_fkey` FOREIGN KEY (`configurationId`) REFERENCES `ProductConfigurationOptions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OptionRule` ADD CONSTRAINT `OptionRule_configurationId_fkey` FOREIGN KEY (`configurationId`) REFERENCES `ProductConfigurationOptions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OptionRule` ADD CONSTRAINT `OptionRule_targetOptionId_fkey` FOREIGN KEY (`targetOptionId`) REFERENCES `Option`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Condition` ADD CONSTRAINT `Condition_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `OptionRule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Condition` ADD CONSTRAINT `Condition_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `Option`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ProductConfigurationOptions_Option` ADD CONSTRAINT `_ProductConfigurationOptions_Option_A_fkey` FOREIGN KEY (`A`) REFERENCES `Option`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ProductConfigurationOptions_Option` ADD CONSTRAINT `_ProductConfigurationOptions_Option_B_fkey` FOREIGN KEY (`B`) REFERENCES `ProductConfigurationOptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
