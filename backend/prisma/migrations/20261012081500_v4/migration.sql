-- v4: email login for admins, revocable login links, audio-in-DB,
-- AI analysis rounds and proposed questions, first-login consent.
ALTER TABLE "User" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

ALTER TABLE "Attachment" ALTER COLUMN "path" DROP NOT NULL;
ALTER TABLE "Attachment" ADD COLUMN "data" BYTEA;

ALTER TABLE "ConsentRecord" ALTER COLUMN "requestId" DROP NOT NULL;
ALTER TABLE "ConsentRecord" ADD COLUMN "userId" TEXT;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

CREATE TABLE "LoginLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LoginLink_tokenHash_key" ON "LoginLink"("tokenHash");
CREATE INDEX "LoginLink_userId_idx" ON "LoginLink"("userId");
ALTER TABLE "LoginLink" ADD CONSTRAINT "LoginLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AiRound" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ANALYSIS',
    "inputText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "output" JSONB,
    "error" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRound_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiRound_requestId_kind_idx" ON "AiRound"("requestId", "kind");
CREATE INDEX "AiRound_status_idx" ON "AiRound"("status");
ALTER TABLE "AiRound" ADD CONSTRAINT "AiRound_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProposedQuestion" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "roundId" TEXT,
    "text" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'AI',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposedQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProposedQuestion_requestId_status_idx" ON "ProposedQuestion"("requestId", "status");
ALTER TABLE "ProposedQuestion" ADD CONSTRAINT "ProposedQuestion_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
