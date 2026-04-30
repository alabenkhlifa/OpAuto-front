-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "mfNumber" TEXT;

-- AlterTable
ALTER TABLE "garages" ADD COLUMN     "discountAuditThresholdPct" DOUBLE PRECISION NOT NULL DEFAULT 5;
