-- AlterTable
ALTER TABLE `Transaction` ADD COLUMN `brokerDealId` VARCHAR(191) NULL;

-- AddUniqueConstraint
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_userId_brokerDealId_key` UNIQUE (`userId`, `brokerDealId`);
