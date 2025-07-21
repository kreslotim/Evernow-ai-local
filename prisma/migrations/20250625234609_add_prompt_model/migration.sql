-- CreateTable
CREATE TABLE "Prompt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "description" TEXT,
    "provider" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prompt_key_key" ON "Prompt"("key");

-- CreateIndex
CREATE INDEX "Prompt_key_idx" ON "Prompt"("key");

-- CreateIndex
CREATE INDEX "Prompt_provider_idx" ON "Prompt"("provider");
