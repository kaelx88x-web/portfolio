-- CreateTable
CREATE TABLE `CompanyNode` (
    `id` VARCHAR(191) NOT NULL,
    `ticker` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sector` VARCHAR(191) NULL,
    `market` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompanyNode_ticker_key`(`ticker`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyEdge` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `type` ENUM('same_sector', 'same_concept', 'co_owned_by', 'competitor', 'supplier', 'customer') NOT NULL,
    `weight` DOUBLE NOT NULL DEFAULT 1,
    `confidence` DOUBLE NULL,
    `groundedSource` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CompanyEdge_sourceId_type_idx`(`sourceId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CompanyEdge` ADD CONSTRAINT `CompanyEdge_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `CompanyNode`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyEdge` ADD CONSTRAINT `CompanyEdge_targetId_fkey` FOREIGN KEY (`targetId`) REFERENCES `CompanyNode`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
