-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" DATETIME
);

-- CreateTable
CREATE TABLE "ActiveSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "popupShown" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodEnd" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SubscriptionHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FreePlanLimits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "tagGlobal" INTEGER NOT NULL DEFAULT 5,
    "metaGlobal" INTEGER NOT NULL DEFAULT 5,
    "metaRemoveCsvLimit" INTEGER NOT NULL DEFAULT 250,
    "metaUpdateCsvLimit" INTEGER NOT NULL DEFAULT 250,
    "tagAddCsvLimit" INTEGER NOT NULL DEFAULT 250,
    "tagRemoveCsvLimit" INTEGER NOT NULL DEFAULT 250,
    "firstUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BasicPlanLimits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "tagGlobal" INTEGER NOT NULL DEFAULT 25,
    "metaGlobal" INTEGER NOT NULL DEFAULT 25,
    "metaRemoveCsvLimit" INTEGER NOT NULL DEFAULT 1500,
    "metaUpdateCsvLimit" INTEGER NOT NULL DEFAULT 1500,
    "tagAddCsvLimit" INTEGER NOT NULL DEFAULT 1500,
    "tagRemoveCsvLimit" INTEGER NOT NULL DEFAULT 1500,
    "firstUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ActiveSubscription_shopDomain_key" ON "ActiveSubscription"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "FreePlanLimits_shopDomain_key" ON "FreePlanLimits"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "BasicPlanLimits_shopDomain_key" ON "BasicPlanLimits"("shopDomain");
