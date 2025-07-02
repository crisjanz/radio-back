-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Station" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "genre" TEXT,
    "type" TEXT,
    "streamUrl" TEXT NOT NULL,
    "favicon" TEXT,
    "logo" TEXT,
    "homepage" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "city" TEXT,
    "metadataApiUrl" TEXT,
    "metadataApiType" TEXT,
    "metadataFormat" TEXT,
    "metadataFields" TEXT,
    "description" TEXT,
    "language" TEXT,
    "frequency" TEXT,
    "establishedYear" INTEGER,
    "owner" TEXT,
    "bitrate" INTEGER,
    "codec" TEXT,
    "facebookUrl" TEXT,
    "twitterUrl" TEXT,
    "instagramUrl" TEXT,
    "youtubeUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "schedule" TEXT,
    "programs" TEXT,
    "tags" TEXT,
    "timezone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Station" ("city", "country", "favicon", "genre", "homepage", "id", "latitude", "logo", "longitude", "metadataApiType", "metadataApiUrl", "metadataFields", "metadataFormat", "name", "streamUrl", "type") SELECT "city", "country", "favicon", "genre", "homepage", "id", "latitude", "logo", "longitude", "metadataApiType", "metadataApiUrl", "metadataFields", "metadataFormat", "name", "streamUrl", "type" FROM "Station";
DROP TABLE "Station";
ALTER TABLE "new_Station" RENAME TO "Station";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
