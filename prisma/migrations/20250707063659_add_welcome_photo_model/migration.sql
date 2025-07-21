-- CreateTable
CREATE TABLE "WelcomePhoto" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WelcomePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WelcomePhoto_isActive_idx" ON "WelcomePhoto"("isActive");

-- CreateIndex
CREATE INDEX "WelcomePhoto_order_idx" ON "WelcomePhoto"("order");

-- CreateIndex
CREATE INDEX "WelcomePhoto_isActive_order_idx" ON "WelcomePhoto"("isActive", "order");
