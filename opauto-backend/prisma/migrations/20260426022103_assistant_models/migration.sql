-- CreateEnum
CREATE TYPE "AssistantMessageRole" AS ENUM ('USER', 'ASSISTANT', 'TOOL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AssistantToolCallStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'DENIED', 'EXECUTED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AssistantBlastTier" AS ENUM ('READ', 'AUTO_WRITE', 'CONFIRM_WRITE', 'TYPED_CONFIRM_WRITE');

-- CreateTable
CREATE TABLE "assistant_conversations" (
    "id" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AssistantMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "toolCallId" TEXT,
    "skillUsed" TEXT,
    "agentUsed" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "llmProvider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_tool_calls" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "toolName" TEXT NOT NULL,
    "argsJson" JSONB NOT NULL,
    "resultJson" JSONB,
    "status" "AssistantToolCallStatus" NOT NULL DEFAULT 'EXECUTED',
    "blastTier" "AssistantBlastTier" NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_conversations_garageId_userId_updatedAt_idx" ON "assistant_conversations"("garageId", "userId", "updatedAt");

-- CreateIndex
CREATE INDEX "assistant_messages_conversationId_createdAt_idx" ON "assistant_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "assistant_tool_calls_conversationId_status_idx" ON "assistant_tool_calls"("conversationId", "status");

-- CreateIndex
CREATE INDEX "assistant_tool_calls_status_expiresAt_idx" ON "assistant_tool_calls"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "garages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_toolCallId_fkey" FOREIGN KEY ("toolCallId") REFERENCES "assistant_tool_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "assistant_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
