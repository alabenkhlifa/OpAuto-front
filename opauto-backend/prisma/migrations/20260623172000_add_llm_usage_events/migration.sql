-- CreateTable
CREATE TABLE "llm_usage_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "latencyMs" INTEGER,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priced" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "conversationId" TEXT,
    "garageId" TEXT,
    "userId" TEXT,
    "assistantMessageId" TEXT,
    "toolCallId" TEXT,
    "toolName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_usage_events_createdAt_idx" ON "llm_usage_events"("createdAt");

-- CreateIndex
CREATE INDEX "llm_usage_events_provider_createdAt_idx" ON "llm_usage_events"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "llm_usage_events_garageId_createdAt_idx" ON "llm_usage_events"("garageId", "createdAt");

-- CreateIndex
CREATE INDEX "llm_usage_events_purpose_createdAt_idx" ON "llm_usage_events"("purpose", "createdAt");

-- CreateIndex
CREATE INDEX "llm_usage_events_model_createdAt_idx" ON "llm_usage_events"("model", "createdAt");

-- CreateIndex
CREATE INDEX "llm_usage_events_conversationId_createdAt_idx" ON "llm_usage_events"("conversationId", "createdAt");
