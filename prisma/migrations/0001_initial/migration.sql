-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PARTNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "LetterMood" AS ENUM ('LOVE', 'GRATEFUL', 'MISSING', 'HAPPY', 'APOLOGY', 'SURPRISE');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('WOULD_YOU_RATHER', 'TRIVIA', 'SPIN_THE_WHEEL', 'TRUTH_OR_DARE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PARTNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Couple" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Couple_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoupleMember" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CoupleMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoupleConfig" (
    "id" TEXT NOT NULL,
    "name1" TEXT NOT NULL,
    "name2" TEXT NOT NULL,
    "anniversaryDate" TIMESTAMP(3) NOT NULL,
    "birthDate1" TIMESTAMP(3),
    "birthDate2" TIMESTAMP(3),
    "tagline" TEXT,
    "heroPhotoUrl" TEXT,
    "spotifyPlaylistUrl" TEXT,
    "backgroundMusicUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoupleConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3),
    "width" INTEGER,
    "height" INTEGER,
    "isVideo" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isMilestoneOnly" BOOLEAN NOT NULL DEFAULT false,
    "albumId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "coupleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverPhotoUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "location" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "coupleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestonePhoto" (
    "milestoneId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,

    CONSTRAINT "MilestonePhoto_pkey" PRIMARY KEY ("milestoneId","photoId")
);

-- CreateTable
CREATE TABLE "Letter" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "isTimeCapsule" BOOLEAN NOT NULL DEFAULT false,
    "unlockAt" TIMESTAMP(3),
    "isOpened" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMP(3),
    "notificationSentAt" TIMESTAMP(3),
    "mood" "LetterMood" NOT NULL DEFAULT 'LOVE',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "coupleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Letter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyNote" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "coupleId" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameQuestion" (
    "id" TEXT NOT NULL,
    "type" "GameType" NOT NULL,
    "question" TEXT NOT NULL,
    "optionA" TEXT,
    "optionB" TEXT,
    "answer" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "playerName" TEXT,
    "questionId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "link" TEXT,
    "category" TEXT,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "coupleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "CoupleMember_userId_key" ON "CoupleMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoupleMember_coupleId_userId_key" ON "CoupleMember"("coupleId", "userId");

-- CreateIndex
CREATE INDEX "Photo_albumId_idx" ON "Photo"("albumId");

-- CreateIndex
CREATE INDEX "Photo_uploadedById_idx" ON "Photo"("uploadedById");

-- CreateIndex
CREATE INDEX "Photo_createdAt_idx" ON "Photo"("createdAt");

-- CreateIndex
CREATE INDEX "Photo_takenAt_idx" ON "Photo"("takenAt");

-- CreateIndex
CREATE INDEX "Photo_isFavorite_idx" ON "Photo"("isFavorite");

-- CreateIndex
CREATE INDEX "Photo_albumId_createdAt_idx" ON "Photo"("albumId", "createdAt");

-- CreateIndex
CREATE INDEX "Photo_uploadedById_createdAt_idx" ON "Photo"("uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "Photo_isFavorite_createdAt_idx" ON "Photo"("isFavorite", "createdAt");

-- CreateIndex
CREATE INDEX "Album_createdAt_idx" ON "Album"("createdAt");

-- CreateIndex
CREATE INDEX "Milestone_createdById_idx" ON "Milestone"("createdById");

-- CreateIndex
CREATE INDEX "Milestone_date_idx" ON "Milestone"("date");

-- CreateIndex
CREATE INDEX "Milestone_createdAt_idx" ON "Milestone"("createdAt");

-- CreateIndex
CREATE INDEX "Milestone_date_createdById_idx" ON "Milestone"("date", "createdById");

-- CreateIndex
CREATE INDEX "Milestone_isPublic_date_idx" ON "Milestone"("isPublic", "date");

-- CreateIndex
CREATE INDEX "Letter_authorId_idx" ON "Letter"("authorId");

-- CreateIndex
CREATE INDEX "Letter_recipientId_idx" ON "Letter"("recipientId");

-- CreateIndex
CREATE INDEX "Letter_createdAt_idx" ON "Letter"("createdAt");

-- CreateIndex
CREATE INDEX "Letter_recipientId_isOpened_createdAt_idx" ON "Letter"("recipientId", "isOpened", "createdAt");

-- CreateIndex
CREATE INDEX "Letter_authorId_createdAt_idx" ON "Letter"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Letter_isTimeCapsule_isOpened_unlockAt_idx" ON "Letter"("isTimeCapsule", "isOpened", "unlockAt");

-- CreateIndex
CREATE INDEX "DailyNote_authorId_idx" ON "DailyNote"("authorId");

-- CreateIndex
CREATE INDEX "DailyNote_date_idx" ON "DailyNote"("date");

-- CreateIndex
CREATE INDEX "DailyNote_date_authorId_idx" ON "DailyNote"("date", "authorId");

-- CreateIndex
CREATE INDEX "GameQuestion_type_idx" ON "GameQuestion"("type");

-- CreateIndex
CREATE INDEX "GameScore_userId_idx" ON "GameScore"("userId");

-- CreateIndex
CREATE INDEX "GameScore_questionId_idx" ON "GameScore"("questionId");

-- CreateIndex
CREATE INDEX "GameScore_userId_isCorrect_idx" ON "GameScore"("userId", "isCorrect");

-- CreateIndex
CREATE INDEX "GameScore_playerName_idx" ON "GameScore"("playerName");

-- CreateIndex
CREATE INDEX "WishItem_category_idx" ON "WishItem"("category");

-- CreateIndex
CREATE INDEX "WishItem_isDone_idx" ON "WishItem"("isDone");

-- CreateIndex
CREATE INDEX "WishItem_isDone_createdAt_idx" ON "WishItem"("isDone", "createdAt");

-- CreateIndex
CREATE INDEX "WishItem_category_isDone_idx" ON "WishItem"("category", "isDone");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoupleMember" ADD CONSTRAINT "CoupleMember_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoupleMember" ADD CONSTRAINT "CoupleMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestonePhoto" ADD CONSTRAINT "MilestonePhoto_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestonePhoto" ADD CONSTRAINT "MilestonePhoto_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyNote" ADD CONSTRAINT "DailyNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyNote" ADD CONSTRAINT "DailyNote_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameScore" ADD CONSTRAINT "GameScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameScore" ADD CONSTRAINT "GameScore_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "GameQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishItem" ADD CONSTRAINT "WishItem_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE SET NULL ON UPDATE CASCADE;

