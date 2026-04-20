-- AlterTable
ALTER TABLE "maintenance_photos" ADD COLUMN     "filename" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "originalName" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "uploadedBy" TEXT;
