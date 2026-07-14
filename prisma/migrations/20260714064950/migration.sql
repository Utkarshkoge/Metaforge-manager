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
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `accountOwner` BOOLEAN NOT NULL DEFAULT false,
    `locale` VARCHAR(191) NULL,
    `collaborator` BOOLEAN NULL DEFAULT false,
    `emailVerified` BOOLEAN NULL DEFAULT false,
    `refreshToken` VARCHAR(191) NULL,
    `refreshTokenExpires` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActiveSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `shopDomain` VARCHAR(191) NOT NULL,
    `plan` ENUM('FREE', 'BASIC', 'ADVANCED') NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `popupShown` BOOLEAN NOT NULL DEFAULT false,
    `currentPeriodEnd` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ActiveSubscription_shopDomain_key`(`shopDomain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubscriptionHistory` (
    `id` VARCHAR(191) NOT NULL,
    `shopDomain` VARCHAR(191) NOT NULL,
    `status` ENUM('CREATED', 'ACTIVATED', 'CANCELLED', 'UPGRADED') NOT NULL,
    `plan` ENUM('FREE', 'BASIC', 'ADVANCED') NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FreePlanLimits` (
    `id` VARCHAR(191) NOT NULL,
    `shopDomain` VARCHAR(191) NOT NULL,
    `tagGlobal` INTEGER NOT NULL DEFAULT 5,
    `metaGlobal` INTEGER NOT NULL DEFAULT 5,
    `metaRemoveCsvLimit` INTEGER NOT NULL DEFAULT 250,
    `metaUpdateCsvLimit` INTEGER NOT NULL DEFAULT 250,
    `tagAddCsvLimit` INTEGER NOT NULL DEFAULT 250,
    `tagRemoveCsvLimit` INTEGER NOT NULL DEFAULT 250,
    `firstUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FreePlanLimits_shopDomain_key`(`shopDomain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BasicPlanLimits` (
    `id` VARCHAR(191) NOT NULL,
    `shopDomain` VARCHAR(191) NOT NULL,
    `tagGlobal` INTEGER NOT NULL DEFAULT 25,
    `metaGlobal` INTEGER NOT NULL DEFAULT 25,
    `metaRemoveCsvLimit` INTEGER NOT NULL DEFAULT 1500,
    `metaUpdateCsvLimit` INTEGER NOT NULL DEFAULT 1500,
    `tagAddCsvLimit` INTEGER NOT NULL DEFAULT 1500,
    `tagRemoveCsvLimit` INTEGER NOT NULL DEFAULT 1500,
    `firstUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BasicPlanLimits_shopDomain_key`(`shopDomain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
