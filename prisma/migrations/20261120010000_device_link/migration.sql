-- One-time 6-digit codes for native WebView sign-in. No existing table changes.
CREATE TABLE "DeviceLinkCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "lookupHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceLinkCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceLinkCode_lookupHash_key" ON "DeviceLinkCode"("lookupHash");
CREATE INDEX "DeviceLinkCode_userId_idx" ON "DeviceLinkCode"("userId");

ALTER TABLE "DeviceLinkCode" ADD CONSTRAINT "DeviceLinkCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
