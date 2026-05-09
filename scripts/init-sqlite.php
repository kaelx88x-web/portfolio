<?php

$dbPath = __DIR__ . '/../prisma/dev.db';
$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('PRAGMA foreign_keys = ON');

$statements = [
    'CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "baseCurrency" TEXT NOT NULL DEFAULT "USD",
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")',

    'CREATE TABLE IF NOT EXISTS "Account" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "brokerName" TEXT NOT NULL,
        "accountType" TEXT NOT NULL,
        "currency" TEXT NOT NULL DEFAULT "USD",
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Account_id_userId_key" ON "Account"("id", "userId")',
    'CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId")',

    'CREATE TABLE IF NOT EXISTS "Asset" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "symbol" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "assetType" TEXT NOT NULL,
        "exchange" TEXT,
        "currency" TEXT NOT NULL DEFAULT "USD",
        "sector" TEXT,
        "country" TEXT,
        "latestPrice" REAL NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Asset_symbol_key" ON "Asset"("symbol")',

    'CREATE TABLE IF NOT EXISTS "Transaction" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "accountId" TEXT NOT NULL,
        "assetId" TEXT,
        "type" TEXT NOT NULL,
        "tradeDate" DATETIME NOT NULL,
        "quantity" REAL NOT NULL DEFAULT 0,
        "price" REAL NOT NULL DEFAULT 0,
        "fee" REAL NOT NULL DEFAULT 0,
        "currency" TEXT NOT NULL DEFAULT "USD",
        "notes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Transaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_id_userId_key" ON "Transaction"("id", "userId")',
    'CREATE INDEX IF NOT EXISTS "Transaction_userId_tradeDate_idx" ON "Transaction"("userId", "tradeDate")',
    'CREATE INDEX IF NOT EXISTS "Transaction_accountId_idx" ON "Transaction"("accountId")',
    'CREATE INDEX IF NOT EXISTS "Transaction_assetId_idx" ON "Transaction"("assetId")',

    'CREATE TABLE IF NOT EXISTS "HoldingSnapshot" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "accountId" TEXT NOT NULL,
        "assetId" TEXT NOT NULL,
        "date" DATETIME NOT NULL,
        "quantity" REAL NOT NULL,
        "averageCost" REAL NOT NULL,
        "marketPrice" REAL NOT NULL,
        "marketValue" REAL NOT NULL,
        "unrealizedPnl" REAL NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "HoldingSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "HoldingSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "HoldingSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "HoldingSnapshot_userId_accountId_assetId_date_key" ON "HoldingSnapshot"("userId", "accountId", "assetId", "date")',
    'CREATE INDEX IF NOT EXISTS "HoldingSnapshot_userId_date_idx" ON "HoldingSnapshot"("userId", "date")',

    'CREATE TABLE IF NOT EXISTS "Watchlist" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Watchlist_id_userId_key" ON "Watchlist"("id", "userId")',
    'CREATE INDEX IF NOT EXISTS "Watchlist_userId_idx" ON "Watchlist"("userId")',

    'CREATE TABLE IF NOT EXISTS "WatchlistItem" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "watchlistId" TEXT NOT NULL,
        "assetId" TEXT NOT NULL,
        "notes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "WatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "WatchlistItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "WatchlistItem_watchlistId_assetId_key" ON "WatchlistItem"("watchlistId", "assetId")'
];

foreach ($statements as $statement) {
    $pdo->exec($statement);
}

echo "SQLite database initialized at {$dbPath}\n";
