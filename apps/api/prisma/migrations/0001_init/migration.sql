CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slotsTotal" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "region" TEXT NOT NULL,
    "constellation" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "planet" TEXT NOT NULL,
    "planetType" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    CONSTRAINT "Assignment_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Scan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "region" TEXT NOT NULL,
    "constellation" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "planet" TEXT NOT NULL,
    "planetType" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "value" REAL NOT NULL
);

CREATE TABLE "Yield" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "notes" TEXT
);

CREATE TABLE "MarketSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'esi',
    "hubAName" TEXT NOT NULL DEFAULT 'Jita',
    "hubBName" TEXT NOT NULL DEFAULT 'C-N4OD',
    "productLimit" INTEGER NOT NULL DEFAULT 50,
    "maxPages" INTEGER NOT NULL DEFAULT 3,
    "janiceApiKey" TEXT,
    "rememberKey" BOOLEAN NOT NULL DEFAULT false
);
