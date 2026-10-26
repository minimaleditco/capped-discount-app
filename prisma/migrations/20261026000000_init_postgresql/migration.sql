-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

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
CREATE TABLE "PartialCodSettings" (
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "depositType" TEXT NOT NULL DEFAULT 'percentage',
    "depositValue" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "minOrderSubtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gateway" TEXT NOT NULL DEFAULT 'simulator',
    "apiKey" TEXT DEFAULT '',
    "apiSecret" TEXT DEFAULT '',
    "autoCancelMinutes" INTEGER NOT NULL DEFAULT 30,
    "metaPixelId" TEXT DEFAULT '',
    "metaCapiToken" TEXT DEFAULT '',
    "whatsappApiKey" TEXT DEFAULT '',
    "whatsappApiUrl" TEXT DEFAULT '',
    "whatsappSender" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartialCodSettings_pkey" PRIMARY KEY ("shop")
);

-- CreateTable
CREATE TABLE "PartialCodDeposit" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "depositAmount" DOUBLE PRECISION NOT NULL,
    "remainingBalance" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "gateway" TEXT NOT NULL DEFAULT 'simulator',
    "gatewayTransactionId" TEXT,
    "customerPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartialCodDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositRule" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "conditionType" TEXT NOT NULL,
    "conditionValue" TEXT NOT NULL,
    "depositType" TEXT NOT NULL,
    "depositValue" DOUBLE PRECISION NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountSavings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "originalDiscountAmount" DOUBLE PRECISION NOT NULL,
    "cappedDiscountAmount" DOUBLE PRECISION NOT NULL,
    "marginSaved" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountSavings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_shop_idx" ON "Session"("shop");

-- CreateIndex
CREATE INDEX "PartialCodDeposit_shop_idx" ON "PartialCodDeposit"("shop");

-- CreateIndex
CREATE INDEX "PartialCodDeposit_orderId_idx" ON "PartialCodDeposit"("orderId");

-- CreateIndex
CREATE INDEX "DepositRule_shop_idx" ON "DepositRule"("shop");

-- CreateIndex
CREATE INDEX "DiscountSavings_shop_idx" ON "DiscountSavings"("shop");

-- CreateIndex
CREATE INDEX "DiscountSavings_orderId_idx" ON "DiscountSavings"("orderId");
