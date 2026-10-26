-- AlterTable
ALTER TABLE "PartialCodSettings" ADD COLUMN IF NOT EXISTS "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PartialCodSettings" ADD COLUMN IF NOT EXISTS "whatsappProvider" TEXT NOT NULL DEFAULT 'simulator';

-- CreateTable
CREATE TABLE IF NOT EXISTS "OtpSession" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otpCode" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OtpSession_token_key" ON "OtpSession"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OtpSession_shop_phone_idx" ON "OtpSession"("shop", "phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OtpSession_token_idx" ON "OtpSession"("token");
