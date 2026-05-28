-- AlterTable
ALTER TABLE `User` ADD COLUMN `activeBrokerAccId` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `Account` ADD COLUMN `brokerAccId` VARCHAR(64) NULL;
