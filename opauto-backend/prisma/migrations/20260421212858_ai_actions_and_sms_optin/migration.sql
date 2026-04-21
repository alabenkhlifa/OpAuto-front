-- CreateEnum
CREATE TYPE "AiActionKind" AS ENUM ('REMINDER_SMS', 'DISCOUNT_SMS');

-- CreateEnum
CREATE TYPE "AiActionStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'FAILED', 'SKIPPED', 'REDEEMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DiscountKind" AS ENUM ('PERCENT', 'AMOUNT');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "smsOptIn" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ai_actions" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "AiActionKind" NOT NULL,
    "status" "AiActionStatus" NOT NULL DEFAULT 'DRAFT',
    "messageBody" TEXT NOT NULL,
    "discountKind" "DiscountKind",
    "discountValue" DOUBLE PRECISION,
    "expiresAt" TIMESTAMP(3),
    "churnRiskSnapshot" DOUBLE PRECISION NOT NULL,
    "factorsSnapshot" TEXT[],
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "approvedByUserId" TEXT,
    "redeemedInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_actions_customerId_status_idx" ON "ai_actions"("customerId", "status");

-- CreateIndex
CREATE INDEX "ai_actions_garageId_status_createdAt_idx" ON "ai_actions"("garageId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "garages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_redeemedInvoiceId_fkey" FOREIGN KEY ("redeemedInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
