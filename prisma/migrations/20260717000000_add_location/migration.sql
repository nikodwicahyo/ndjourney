-- Migration: add location sharing models
CREATE TABLE "LocationShare" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "coupleId" TEXT NOT NULL,
  "isSharing" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LocationShare_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserLocation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "coupleId" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "accuracy" DOUBLE PRECISION,
  "deviceType" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LocationShare_userId_key" ON "LocationShare"("userId");
CREATE INDEX "LocationShare_coupleId_idx" ON "LocationShare"("coupleId");

CREATE UNIQUE INDEX "UserLocation_userId_key" ON "UserLocation"("userId");
CREATE INDEX "UserLocation_coupleId_idx" ON "UserLocation"("coupleId");

ALTER TABLE "LocationShare" ADD CONSTRAINT "LocationShare_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LocationShare" ADD CONSTRAINT "LocationShare_coupleId_fkey"
  FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_coupleId_fkey"
  FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;
