-- AlterTable
ALTER TABLE `ProductConfigurationOptions` ADD COLUMN `roundingEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `roundingPrecision` VARCHAR(191) NOT NULL DEFAULT '1';
