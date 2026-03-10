-- AlterTable VirtualProductVariant
ALTER TABLE `VirtualProductVariant` ADD COLUMN `manualPrice` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable OptionRule
ALTER TABLE `OptionRule` ADD COLUMN `targetValueId` VARCHAR(191) NULL,
    ADD COLUMN `priority` INTEGER NOT NULL DEFAULT 0;
