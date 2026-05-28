-- AlterTable
ALTER TABLE `Account` ADD CONSTRAINT `Account_userId_brokerAccId_key` UNIQUE(`userId`, `brokerAccId`);
