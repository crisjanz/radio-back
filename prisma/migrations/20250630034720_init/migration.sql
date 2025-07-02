-- CreateTable
CREATE TABLE "Station" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "genre" TEXT,
    "type" TEXT,
    "streamUrl" TEXT NOT NULL
);
