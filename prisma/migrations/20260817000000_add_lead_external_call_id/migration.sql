-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "externalCallId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_externalCallId_key" ON "Lead"("externalCallId");
