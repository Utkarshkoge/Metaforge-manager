-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'BASIC', 'ADVANCED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('CREATED', 'ACTIVATED', 'CANCELLED', 'UPGRADED');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
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
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveSubscription" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "popupShown" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActiveSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreePlanLimits" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "tagGlobal" INTEGER NOT NULL DEFAULT 2,
    "metaGlobal" INTEGER NOT NULL DEFAULT 2,
    "metaRemoveCsvLimit" INTEGER NOT NULL DEFAULT 200,
    "metaUpdateCsvLimit" INTEGER NOT NULL DEFAULT 200,
    "tagAddCsvLimit" INTEGER NOT NULL DEFAULT 200,
    "tagRemoveCsvLimit" INTEGER NOT NULL DEFAULT 200,
    "firstUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreePlanLimits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BasicPlanLimits" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "tagGlobal" INTEGER NOT NULL DEFAULT 20,
    "metaGlobal" INTEGER NOT NULL DEFAULT 20,
    "metaRemoveCsvLimit" INTEGER NOT NULL DEFAULT 3000,
    "metaUpdateCsvLimit" INTEGER NOT NULL DEFAULT 3000,
    "tagAddCsvLimit" INTEGER NOT NULL DEFAULT 3000,
    "tagRemoveCsvLimit" INTEGER NOT NULL DEFAULT 3000,
    "firstUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BasicPlanLimits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActiveSubscription_shopDomain_key" ON "ActiveSubscription"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "FreePlanLimits_shopDomain_key" ON "FreePlanLimits"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "BasicPlanLimits_shopDomain_key" ON "BasicPlanLimits"("shopDomain");
